import * as THREE from 'three'
import { Water } from './vendor/three/Water.js'
import { Sky } from './vendor/three/Sky.js'
import { enu, toRad } from './geometry.js'
import { VIEWS, DEFAULT_VIEW } from './config.js'
import { PerspectiveProjection } from './projections.js'
import { fogDensity } from './projection-math.js'

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

  const sky = new Sky(); sky.scale.setScalar(60000); scene.add(sky)
  sky.material.uniforms.turbidity.value = 8
  sky.material.uniforms.rayleigh.value = 2
  sky.material.uniforms.mieCoefficient.value = 0.005
  sky.material.uniforms.mieDirectionalG.value = 0.8
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.0); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0xffffff, 0.3))
  scene.fog = new THREE.FogExp2(0x9fb6c8, fogDensity(40))
  const sunV = new THREE.Vector3()

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

  // elevation/azimuth in degrees (from sky.js sunPosition); sightlineKm from weather/controls.
  function updateEnv(env) {
    const el = toRad(env.sunEl), az = toRad(env.sunAz)
    // ENU/THREE dir: x=east, y=up, z=-north.
    sunV.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az))
    sky.material.uniforms.sunPosition.value.copy(sunV)
    water.material.uniforms.sunDirection.value.copy(sunV).normalize()
    sunLight.position.copy(sunV).multiplyScalar(10000)
    sunLight.intensity = Math.max(0.05, Math.sin(Math.max(0, el)) * 1.2)
    if (env.sightlineKm != null) scene.fog.density = fogDensity(env.sightlineKm)
  }

  return { renderer, scene, water, setProjection, getProjection: () => projection, updateEnv, resize, render }
}
