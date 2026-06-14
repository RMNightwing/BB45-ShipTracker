import * as THREE from 'three'
import { toRad } from './geometry.js'
import { vFovFromHFov, cylindricalProject } from './projection-math.js'

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

// Wide-view projection: render the scene into a world-aligned cube map at the eye,
// then a fullscreen quad samples it by (azimuth, elevation). Materials, fog, and
// reflections all work unmodified. project() mirrors the sampling for HUD/hover.
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
    // DIAGNOSTIC (temporary): try/catch + one-shot log to localize the black screen.
    try {
      this.cubeCam.update(renderer, scene)
      renderer.render(this.quadScene, this.quadCam)
      if (!this._logged) {
        this._logged = true
        console.log('[cyl] render ran; cube rt', this.cubeCam.renderTarget && this.cubeCam.renderTarget.width,
          'fovX', this.mat.uniforms.fovX.value.toFixed(3), 'fovY', this.mat.uniforms.fovY.value.toFixed(3),
          'eye', this.eye.toArray().map(v => Math.round(v)))
      }
    } catch (e) { console.error('[cyl] render threw:', e) }
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
