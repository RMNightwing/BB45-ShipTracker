import * as THREE from 'three'
import { toRad } from './geometry.js'
import { vFovFromHFov } from './projection-math.js'

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
