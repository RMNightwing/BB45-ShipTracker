import * as THREE from 'three'
import { Water } from '../vendor/three/Water.js'
import { Sky } from '../vendor/three/Sky.js'
import { enu, toRad, hullDownState } from './geometry.js'
import { VIEWS, DEFAULT_VIEW, SUPERSTRUCTURE_M, NEAR_KM, FAR_KM,
  SIZE_GAIN, SIZE_CONSTANCY, MIN_ANGLE, MAX_ANGLE, DEPTH_SPREAD, HAZE_STRENGTH, HAZE_FLOOR } from './config.js'
import { apparentAngle, renderedDistanceKm, shipClarity } from './perception.js'
import { makeShipMesh, makeWake, shipMaterials } from './ship-meshes.js'
import { createShipModels } from './ship-models.js'
import { createStarField } from './star-field.js'
import { PerspectiveProjection, TiledPanoramaProjection } from './projections.js'
import { fogDensity } from './projection-math.js'

// One fixed ENU origin for the whole world (the main viewpoint). Each view's
// camera sits at its own offset from here.
const ORIGIN = { lat: VIEWS[DEFAULT_VIEW].lat, lon: VIEWS[DEFAULT_VIEW].lon }
export function viewEye(view) { return enu(view.lat, view.lon, ORIGIN.lat, ORIGIN.lon) }

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.localClippingEnabled = true   // per-ship hull-down clip planes
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

  // Day/night backdrop, fog, and water colors, lerped by starAlpha in updateEnv. By
  // day the Sky mesh covers the background; at deep night the Sky is hidden and these
  // show. Water also darkens at night so it stops reading tropical-teal after dusk.
  const DAY_BG = new THREE.Color(0x8fb6e6), NIGHT_BG = new THREE.Color(0x05070d)
  const DAY_FOG = new THREE.Color(0x9fb6c8), NIGHT_FOG = new THREE.Color(0x0a0e18)
  const DAY_WATER = new THREE.Color(0x355766), NIGHT_WATER = new THREE.Color(0x05090f)

  // Real magnitude-6 sky placed at true alt/az for the deck, wheeling with the clock,
  // with constellation lines. Replaces the old even Fibonacci field (which read as a grid).
  const starField = createStarField(scene)

  let projection = null
  let W = 0, H = 0
  function setProjection(view) {
    if (projection) projection.dispose()
    // Wide views (the full sweep) render as a tiled panorama; the narrow main view stays a
    // plain perspective camera. (The cube CylindricalProjection is superseded — see projections.js.)
    projection = view.fov > 100
      ? new TiledPanoramaProjection(view, viewEye(view))
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
    water.material.uniforms.waterColor.value.copy(DAY_WATER).lerp(NIGHT_WATER, night)
    starField.setNightAlpha(night)
    if (env.date) starField.update(env.date)
    sky.visible = night < 0.95                          // hide the daytime sky model at deep night
    const windScale = 0.5 + (env.windKn ?? 6) / 12      // stronger wind → choppier water
    water.material.uniforms.distortionScale.value = 3.0 * windScale
  }

  const shipLayer = new THREE.Group(); scene.add(shipLayer)
  const meshes = new Map()
  const shipModels = createShipModels()
  // Model if its GLB is loaded for this type, else the procedural mesh (also during async load).
  const makeShip = s => shipModels.modelReady(s.type) ? shipModels.makeShipModel(s) : makeShipMesh(s)
  // Caller sets s._distanceKm and s._enu (ENU vs DEFAULT_VIEW origin) on each ship.
  function updateShips(ships, env) {
    const eye = projection ? projection.eyeGround() : { e: 0, n: 0 }
    const sizeGain = env.sizeGain ?? SIZE_GAIN
    const depthSpread = env.depthSpread ?? DEPTH_SPREAD
    const hazeStrength = env.hazeStrength ?? HAZE_STRENGTH
    const haze = scene.fog.color                       // tint ships fade toward
    const seen = new Set()
    for (const s of ships) {
      const hd = hullDownState(s._distanceKm, env.deckHeight, SUPERSTRUCTURE_M)
      if (hd.state === 'gone') continue
      seen.add(s.id)
      let sp = meshes.get(s.id)
      const len = s.len || 80
      if (!sp || sp.userData.type !== s.type || sp.userData.len !== len ||
          (shipModels.modelReady(s.type) && !sp.userData.isModel)) {
        if (sp) { shipLayer.remove(sp); disposeShip(sp) }
        sp = makeShip(s)
        sp.userData.type = s.type; sp.userData.len = len
        sp.userData.clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        sp.userData.materials = shipMaterials(sp)
        for (const m of sp.userData.materials) {
          m.clippingPlanes = [sp.userData.clip]
          m.fog = false                                // ships use perceptual haze, not scene FogExp2
          if (m.color) m.userData.baseColor = m.color.clone()  // remember the un-hazed colour
          if (m.emissive) m.emissive.setHex(0x223038)  // fixed moonlit tint; only intensity varies
          m.needsUpdate = true
        }
        // Wake is added AFTER shipMaterials() above, so it keeps scene fog (and no
        // perceptual haze/baseColor) — a foam trail fading on the optical curve.
        sp.add(makeWake(len, s.kn))
        shipLayer.add(sp); meshes.set(s.id, sp)
      }
      // Perceptual placement: true bearing fixes the azimuth ray; the depth rule sets
      // how far down it the ship sits (vertical position); the size rule sets its
      // on-screen angular size. Bearing stays exact; size/position are independent.
      const dPrimeKm = renderedDistanceKm(s._distanceKm, depthSpread, NEAR_KM, FAR_KM)
      const f = dPrimeKm / Math.max(0.001, s._distanceKm)
      sp.position.set(eye.e + f * (s._enu.e - eye.e), 0, -(eye.n + f * (s._enu.n - eye.n)))
      sp.rotation.y = -toRad(s.course ?? s.cog ?? 0)
      const ang = apparentAngle(len, s._distanceKm, sizeGain, SIZE_CONSTANCY, MIN_ANGLE, MAX_ANGLE)
      const scale = ang * (dPrimeKm * 1000) / len
      sp.scale.setScalar(scale)
      // Hull-down (TRUE distance): raise the world clip plane to cut the lower hull.
      const worldH = sp.userData.heightM * scale
      sp.userData.clip.constant = -(hd.clipFrac * worldH)
      // Perceptual haze (TRUE distance) + night emissive floor.
      const clarity = shipClarity(s._distanceKm, FAR_KM, hazeStrength, HAZE_FLOOR)
      const emis = Math.max(0, 0.5 - (env.ambient ?? 1) * 0.5)
      for (const m of sp.userData.materials) {
        if (m.userData.baseColor) m.color.copy(m.userData.baseColor).lerp(haze, 1 - clarity)
        if (m.emissive) m.emissiveIntensity = emis
      }
      sp.userData.ship = s; sp.userData.hullDown = hd.state === 'hulldown'
    }
    for (const [id, sp] of meshes) {
      if (seen.has(id)) continue
      shipLayer.remove(sp); disposeShip(sp); meshes.delete(id)
    }
  }
  function disposeShip(sp) {
    sp.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose()
      if (o.material) {
        if (o.material.map && !o.material.map.userData.shared) o.material.map.dispose()
        o.material.dispose()
      }
    })
  }
  // Screen rects for overlay hover/tooltip, anchored at the ship's mid-height.
  function shipScreenRects() {
    const out = []
    const proj = projection
    if (!proj) return out
    for (const sp of meshes.values()) {
      const c = sp.position.clone()
      c.y += sp.userData.heightM * sp.scale.x * 0.5
      const p = proj.project(c)
      if (p.visible) out.push({ ref: sp.userData.ship.id, ship: sp.userData.ship, distanceKm: sp.userData.ship._distanceKm, hullDown: sp.userData.hullDown, x: p.x, y: p.y })
    }
    return out
  }

  return { renderer, scene, water, setProjection, getProjection: () => projection, updateEnv, resize, render, updateShips, shipScreenRects,
    setConstellationLines: b => starField.setLinesVisible(b) }
}
