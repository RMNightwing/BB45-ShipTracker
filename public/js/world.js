import * as THREE from 'three'
import { Water } from './vendor/three/Water.js'
import { enu } from './geometry.js'
import { VIEWS, DEFAULT_VIEW } from './config.js'
import { PerspectiveProjection } from './projections.js'

// One fixed ENU origin for the whole world (the main viewpoint). Each view's
// camera sits at its own offset from here.
const ORIGIN = { lat: VIEWS[DEFAULT_VIEW].lat, lon: VIEWS[DEFAULT_VIEW].lon }
export function viewEye(view) { return enu(view.lat, view.lon, ORIGIN.lat, ORIGIN.lon) }

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x8fb6e6)

  const water = new Water(new THREE.PlaneGeometry(80000, 80000), {
    textureWidth: 512, textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load('vendor/three/waternormals.jpg', t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
    }),
    sunDirection: new THREE.Vector3(0, 1, 0),
    waterColor: 0x355766, distortionScale: 3.0, fog: true
  })
  water.rotation.x = -Math.PI / 2
  scene.add(water)

  let projection = null
  let W = 0, H = 0
  function setProjection(view) {
    projection = new PerspectiveProjection(view, viewEye(view))
    if (W) projection.resize(W, H)
  }
  function resize(w, h) {
    W = w; H = h; renderer.setSize(w, h, false)
    if (projection) projection.resize(w, h)
  }
  function render(t) {
    water.material.uniforms.time.value = (t || 0) * 0.0005
    if (projection) projection.render(renderer, scene)
  }

  return { renderer, scene, water, setProjection, getProjection: () => projection, resize, render }
}
