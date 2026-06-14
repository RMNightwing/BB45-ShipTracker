import * as THREE from 'three'
import { Water } from '../vendor/three/Water.js'
import { Sky } from '../vendor/three/Sky.js'
import { enu, toRad, hullDownState } from './geometry.js'
import { VIEWS, DEFAULT_VIEW, SUPERSTRUCTURE_M } from './config.js'
import { makeShipSprite, shipTexture } from './ship-sprites.js'
import { PerspectiveProjection, CylindricalProjection } from './projections.js'
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

  // Day/night backdrop + fog colors, lerped by starAlpha in updateEnv. By day the
  // Sky mesh covers the background; at deep night the Sky is hidden and these show.
  const DAY_BG = new THREE.Color(0x8fb6e6), NIGHT_BG = new THREE.Color(0x05070d)
  const DAY_FOG = new THREE.Color(0x9fb6c8), NIGHT_FOG = new THREE.Color(0x0a0e18)

  // Fixed starfield on a large dome; opacity driven by env.starAlpha. Deterministic
  // scatter (golden-ratio sequence) so positions are stable without Math.random.
  const starGeo = new THREE.BufferGeometry()
  const starN = 1200, starPos = new Float32Array(starN * 3)
  for (let i = 0; i < starN; i++) {
    const th = i * 2.399963229      // golden angle (rad)
    const ph = Math.acos(2 * ((i * 0.6180339887) % 1) - 1)
    const R = 50000
    starPos[i * 3] = R * Math.sin(ph) * Math.cos(th)
    starPos[i * 3 + 1] = Math.abs(R * Math.cos(ph))   // upper hemisphere only
    starPos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th)
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xfffff5, size: 120, sizeAttenuation: true, transparent: true, opacity: 0, fog: false
  }))
  scene.add(stars)

  let projection = null
  let W = 0, H = 0
  function setProjection(view) {
    if (projection) projection.dispose()
    projection = view.fov > 100
      ? new CylindricalProjection(view, viewEye(view))
      : new PerspectiveProjection(view, viewEye(view))
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
    const night = env.starAlpha ?? 0
    scene.background.copy(DAY_BG).lerp(NIGHT_BG, night)
    scene.fog.color.copy(DAY_FOG).lerp(NIGHT_FOG, night)
    stars.material.opacity = night
    sky.visible = night < 0.95                          // hide the daytime sky model at deep night
    const windScale = 0.5 + (env.windKn ?? 6) / 12      // stronger wind → choppier water
    water.material.uniforms.distortionScale.value = 3.0 * windScale
  }

  const shipLayer = new THREE.Group(); scene.add(shipLayer)
  const sprites = new Map()
  // Caller must set s._distanceKm and s._enu on each ship before calling.
  // Texture rebuilt per frame — fine for the ~9-ship fleet; cache later if needed.
  function updateShips(ships, env) {
    const seen = new Set()
    for (const s of ships) {
      const hd = hullDownState(s._distanceKm, env.deckHeight, SUPERSTRUCTURE_M)
      if (hd.state === 'gone') continue
      seen.add(s.id)
      let sp = sprites.get(s.id)
      if (!sp) { sp = makeShipSprite(); shipLayer.add(sp); sprites.set(s.id, sp) }
      const { e, n } = s._enu
      const lenM = s.len || 80, hM = lenM * 0.46     // sprite covers ~length × ~0.46·length tall
      sp.position.set(e, hM * 0.5 * (1 - hd.clipFrac), -n)
      sp.scale.set(lenM, hM, 1)
      if (sp.material.map) sp.material.map.dispose()
      sp.material.map = shipTexture(s, env.ambient, hd.clipFrac)
      sp.material.needsUpdate = true
      sp.userData.ship = s; sp.userData.hullDown = hd.state === 'hulldown'
    }
    for (const [id, sp] of sprites) {
      if (seen.has(id)) continue
      shipLayer.remove(sp)
      if (sp.material.map) sp.material.map.dispose()
      sp.material.dispose()
      sprites.delete(id)
    }
  }
  // Screen rects for overlay hover/tooltip, via the active projection.
  function shipScreenRects() {
    const out = []
    const proj = projection
    if (!proj) return out
    for (const sp of sprites.values()) {
      const p = proj.project(sp.position)
      if (p.visible) out.push({ ref: sp.userData.ship.id, ship: sp.userData.ship, distanceKm: sp.userData.ship._distanceKm, hullDown: sp.userData.hullDown, x: p.x, y: p.y })
    }
    return out
  }

  return { renderer, scene, water, setProjection, getProjection: () => projection, updateEnv, resize, render, updateShips, shipScreenRects }
}
