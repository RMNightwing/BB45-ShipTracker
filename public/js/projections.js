import * as THREE from 'three'
import { toRad, normalizeSigned } from './geometry.js'
import { vFovFromHFov, cylindricalProject, bearingOfDir, tileAzOffset, tileIndexForAz } from './projection-math.js'

// Perspective projection for the narrow main view: a plain PerspectiveCamera.
// eyeENU = {e, n} of the viewpoint relative to the world origin; view.height m above sea.
export class PerspectiveProjection {
  constructor(view, eyeENU) {
    this.view = view
    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 80000)
    this.camera.position.set(eyeENU.e, view.height, -eyeENU.n)
    // Yaw to the view bearing (0=N=-Z, +X=E), level pitch. rotation.y = -bearing.
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = -toRad(view.viewBearing)
    this._w = 1; this._h = 1
  }
  resize(w, h) {
    this.camera.aspect = w / h
    this.camera.fov = vFovFromHFov(this.view.fov, w / h)
    this.camera.updateProjectionMatrix()
    this._w = w; this._h = h
  }
  render(renderer, scene) { renderer.render(scene, this.camera) }
  // Ground point {e,n} of the eye in the world ENU frame (x=e, z=-n).
  eyeGround() { return { e: this.camera.position.x, n: -this.camera.position.z } }
  dispose() {}
  // World position (THREE.Vector3) → screen px (CSS pixels). visible=false off-screen/behind.
  project(worldPos) {
    const v = worldPos.clone().project(this.camera)
    return {
      x: (v.x * 0.5 + 0.5) * this._w,
      y: (-v.y * 0.5 + 0.5) * this._h,
      visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1
    }
  }
}

// SUPERSEDED by TiledPanoramaProjection (below). The cube path renders black in-browser:
// the render runs with no shader error, but the cube comes up empty — the Water reflector
// does its own render-target swaps inside the 6 cube-face passes and leaves the cube blank
// (and a single planar reflection rendered into a cube is wrong anyway). Kept for reference.
// Wide-view projection: render the scene into a world-aligned cube map at the eye,
// then a fullscreen quad samples it by (azimuth, elevation). project() mirrors the sampling.
export class CylindricalProjection {
  constructor(view, eyeENU) {
    this.view = view
    this.eye = new THREE.Vector3(eyeENU.e, view.height, -eyeENU.n)
    const rt = new THREE.WebGLCubeRenderTarget(1024, { generateMipmaps: false })
    this.cubeCam = new THREE.CubeCamera(1, 80000, rt)
    this.cubeCam.position.copy(this.eye)
    this.quadScene = new THREE.Scene()
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tCube: { value: rt.texture },
        viewBearing: { value: toRad(view.viewBearing) },
        fovX: { value: toRad(view.fov) },
        fovY: { value: toRad(view.fov) }   // set per-aspect in resize()
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform samplerCube tCube; uniform float viewBearing, fovX, fovY; varying vec2 vUv;
        void main(){
          float az = viewBearing + (vUv.x - 0.5) * fovX;
          float el = (vUv.y - 0.5) * fovY;
          vec3 dir = vec3(sin(az)*cos(el), sin(el), -cos(az)*cos(el));
          gl_FragColor = textureCube(tCube, dir);
        }`
    })
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat))
    this._w = 1; this._h = 1
  }
  resize(w, h) {
    this._w = w; this._h = h
    this.mat.uniforms.fovY.value = toRad(this.view.fov) * (h / w)
  }
  render(renderer, scene) {
    this.cubeCam.update(renderer, scene)
    renderer.render(this.quadScene, this.quadCam)
  }
  eyeGround() { return { e: this.eye.x, n: -this.eye.z } }
  dispose() {
    this.cubeCam.renderTarget.dispose()
    this.mat.dispose()
    this.quadScene.children[0].geometry.dispose()
  }
  // World position (THREE.Vector3) → screen px, matching the composite's sampling.
  project(worldPos) {
    const d = worldPos.clone().sub(this.eye)
    return cylindricalProject({ x: d.x, y: d.y, z: d.z }, this.view, this._w, this._h / 2)
  }
}

// Wide-view projection without the fragile cube path: render the scene as N narrow
// perspective slices side by side (each a real PerspectiveCamera yawed across the view
// bearing). Water/fog/ships/reflections all work exactly like the main view, and each
// ~fov/N° slice has almost no edge stretch — so the full sweep is preserved undistorted.
export class TiledPanoramaProjection {
  constructor(view, eyeENU, tiles = 4) {
    this.view = view
    this.tiles = tiles
    this.eye = new THREE.Vector3(eyeENU.e, view.height, -eyeENU.n)
    const hFov = view.fov / tiles
    this.cameras = []
    for (let i = 0; i < tiles; i++) {
      const cam = new THREE.PerspectiveCamera(50, 1, 1, 80000)
      cam.position.copy(this.eye)
      cam.rotation.order = 'YXZ'                 // yaw to this slice's bearing, level pitch
      cam.rotation.y = -toRad(view.viewBearing + tileAzOffset(i, view.fov, tiles))
      cam.userData.hFov = hFov
      this.cameras.push(cam)
    }
    this._w = 1; this._h = 1
  }
  // Integer pixel bounds of slice i, tiling the width exactly (no gaps from rounding).
  _bounds(i) {
    const x0 = Math.round(i * this._w / this.tiles)
    const x1 = Math.round((i + 1) * this._w / this.tiles)
    return { x0, w: x1 - x0 }
  }
  resize(w, h) {
    this._w = w; this._h = h
    for (let i = 0; i < this.tiles; i++) {
      const cam = this.cameras[i], b = this._bounds(i)
      cam.aspect = b.w / h
      cam.fov = vFovFromHFov(cam.userData.hFov, cam.aspect)
      cam.updateProjectionMatrix()
    }
  }
  render(renderer, scene) {
    renderer.setScissorTest(true)               // each slice clears + draws only its strip
    for (let i = 0; i < this.tiles; i++) {
      const b = this._bounds(i)
      renderer.setViewport(b.x0, 0, b.w, this._h)
      renderer.setScissor(b.x0, 0, b.w, this._h)
      renderer.render(scene, this.cameras[i])
    }
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, this._w, this._h)
  }
  eyeGround() { return { e: this.eye.x, n: -this.eye.z } }
  dispose() {}
  // World position → screen px: find the slice its bearing falls in, project with that
  // slice's camera, then offset into the slice. Used for hover/tooltip rects.
  project(worldPos) {
    const d = worldPos.clone().sub(this.eye)
    const relAz = normalizeSigned(bearingOfDir({ x: d.x, y: d.y, z: d.z }) - this.view.viewBearing)
    const i = tileIndexForAz(relAz, this.view.fov, this.tiles)
    if (i < 0) return { x: 0, y: 0, visible: false }
    const v = worldPos.clone().project(this.cameras[i])
    const b = this._bounds(i)
    return {
      x: b.x0 + (v.x * 0.5 + 0.5) * b.w,
      y: (-v.y * 0.5 + 0.5) * this._h,
      visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1
    }
  }
}
