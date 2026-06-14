# Three.js 3D Migration + Two-View System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2D canvas painter with a Three.js render layer (real sky, sun, reflective sea, fogged ships) and add a two-view system — a narrow perspective `main` view and the wide cylindrical `max` sweep.

**Architecture:** A WebGL canvas (the 3D world: sky, sun, sea, ships, ridge, fog) sits under a transparent 2D overlay canvas (deck, palms, compass) plus the existing HTML panels. The world is built once in local ENU metres; a `Projection` interface owns how it reaches the screen (perspective for `main`, cylindrical render-to-target for `max`) and how a world point maps back to a screen pixel (for hover/tooltips). All non-render modules (`geometry`, `sky`, `weather`, `sim`, `store`, relay, `ui`) are reused.

**Tech Stack:** Vanilla ES modules, no bundler. Three.js r0.160.0 vendored locally under `public/vendor/three/` and imported via an importmap. Node's built-in test runner (`node --test`) for the pure logic.

---

## Spec

`docs/superpowers/specs/2026-06-14-threejs-3d-migration.md`

## File structure

**New files**
- `public/js/view.js` — active-view state: `activeView()`, `activeViewName()`, `setView()`, `onViewChange()`.
- `public/js/projection-math.js` — pure projection math: `vFovFromHFov()`, `fogDensity()`, `bearingOfDir()`, `cylindricalProject()`. Node-testable.
- `public/js/world.js` — builds + updates the Three scene (sky, water, sun light, fog, ship sprites). Uses THREE.
- `public/js/projections.js` — `PerspectiveProjection`, `CylindricalProjection` (implement the `Projection` interface). Uses THREE.
- `public/js/ship-sprites.js` — render a per-type silhouette to a `CanvasTexture`, build/scale a `THREE.Sprite`. Uses DOM canvas + THREE.
- `public/js/overlay.js` — the 2D foreground/HUD draw (deck, palms, compass) onto the overlay canvas.
- `public/vendor/three/three.module.js`, `.../Sky.js`, `.../Water.js`, `.../waternormals.jpg`, `.../README.md` — vendored library.
- Tests: `public/js/view.test.js`, `public/js/projection-math.test.js`, plus additions to `public/js/geometry.test.js`.

**Modified files**
- `public/js/config.js` — `DECK` → `VIEWS` + `DEFAULT_VIEW`; retire `EXAGGERATION`.
- `public/js/geometry.js` — add `enu()`.
- `public/js/sim.js` — spawn against `VIEWS.max` instead of `DECK`.
- `public/js/weather.js` — default coords from `VIEWS[DEFAULT_VIEW]`.
- `public/js/scene.js` — keep only `drawDeck`/`drawPalms`/`drawCompass` (move to overlay); read active view; delete sky/sea/cloud/star/moon/landfall 2D draws at cleanup.
- `public/js/ships.js` — export `SILHOUETTES`, `shipPalette`, `lodDetail` for reuse; the canvas `drawShip` is retired at cleanup.
- `public/js/ui.js` — add `initViewToggle()`.
- `public/js/main.js` — rewired to drive the Three world + overlay.
- `public/index.html` — add WebGL canvas, overlay canvas, importmap, view toggle button.

## Conventions reminder

2-space indent, camelCase, minimal comments. Logic modules define functions at import time only (no DOM at top level) so they unit-test under Node. The render modules (`world`, `projections`, `ship-sprites`, `overlay`) DO touch the DOM/THREE and are verified visually, not under Node.

## Verification reality

The WebGL layer cannot run under `node --test` (no GL context) and the sandbox localhost is unreachable from the user's browser. Pure logic is covered by Node tests; render tasks end with a **manual visual check**: the user runs `npm start` on their Windows host and eyeballs `http://localhost:5173`. Visual-check steps say exactly what to look for.

---

## Task 1: Two-view config + toggle (on the existing canvas)

Pure data/config refactor on the known-good 2D renderer. No WebGL yet.

**Files:**
- Modify: `public/js/config.js`
- Create: `public/js/view.js`
- Create: `public/js/view.test.js`
- Modify: `public/js/geometry.test.js` (landfall-in-frame)
- Modify: `public/js/sim.js`, `public/js/weather.js`, `public/js/scene.js`, `public/js/ships.js`, `public/js/main.js`
- Modify: `public/js/ui.js`, `public/index.html`

- [ ] **Step 1: Replace `DECK` with `VIEWS` in config.js**

In `public/js/config.js`, delete the `DECK` block (lines 5-11) and add:

```js
// The two measured viewpoints — source of truth for the whole view. Edges were
// taken at night off nearby landmarks and are provisional (fine-tune pending a
// morning check). Keep these easily editable.
//   main: narrow, from further back on the deck. horizon 3.57·√32 ≈ 20.2 km.
//   max:  full sweep, from the deck peak.        horizon 3.57·√30.5 ≈ 19.7 km.
export const VIEWS = {
  main: { label: 'Main',       lat: 12.135972, lon: -68.989167, height: 32,
          viewBearing: 219.5, fov: 71 },   // edges 184° → 255°
  max:  { label: 'Full sweep', lat: 12.135778, lon: -68.989280, height: 30.5,
          viewBearing: 223,   fov: 156 }   // edges 145° → 301°
}
export const DEFAULT_VIEW = 'main'
```

Leave `EXAGGERATION` in place for now (Task 1 still uses the 2D renderer); it is removed at cleanup.

- [ ] **Step 2: Write the failing test for view.js**

Create `public/js/view.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VIEWS, DEFAULT_VIEW } from './config.js'
import { activeView, activeViewName, setView, onViewChange } from './view.js'

test('starts on the default view', () => {
  assert.equal(activeViewName(), DEFAULT_VIEW)
  assert.equal(activeView(), VIEWS[DEFAULT_VIEW])
})

test('setView switches and notifies listeners', () => {
  let seen = null
  onViewChange((v, name) => { seen = name })
  setView('max')
  assert.equal(activeViewName(), 'max')
  assert.equal(activeView(), VIEWS.max)
  assert.equal(seen, 'max')
  setView('main') // restore for other tests
})

test('setView ignores unknown names', () => {
  setView('nope')
  assert.equal(activeViewName(), 'main')
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './view.js'`.

- [ ] **Step 4: Implement view.js**

Create `public/js/view.js`:

```js
import { VIEWS, DEFAULT_VIEW } from './config.js'

let active = DEFAULT_VIEW
const listeners = []

export function activeView() { return VIEWS[active] }
export function activeViewName() { return active }

export function setView(name) {
  if (!VIEWS[name] || name === active) return
  active = name
  for (const cb of listeners) cb(VIEWS[active], active)
}

export function onViewChange(cb) { listeners.push(cb) }
```

- [ ] **Step 5: Run it to confirm it passes**

Run: `npm test`
Expected: the three view tests PASS.

- [ ] **Step 6: Write the failing landfall-in-frame test**

Append to `public/js/geometry.test.js`:

```js
import { VIEWS } from './config.js'
import { LANDFALL } from './config.js'

test('Venezuela landfall stays in frame in both views', () => {
  for (const name of ['main', 'max']) {
    const v = VIEWS[name]
    const off = Math.abs(normalizeSigned(LANDFALL.bearing - v.viewBearing))
    assert.ok(off <= v.fov / 2, `${name}: landfall ${off.toFixed(1)}° vs half-fov ${v.fov / 2}°`)
  }
})
```

(If `normalizeSigned`/`assert`/`test` are already imported at the top of the file, don't duplicate the imports — only add the missing `VIEWS`/`LANDFALL` import and the test.)

- [ ] **Step 7: Run it — it should already PASS**

Run: `npm test`
Expected: PASS. main: 29.5° ≤ 35.5°; max: 26° ≤ 78°. (This test guards the refactor, so it passes immediately — that's correct.)

- [ ] **Step 8: Point sim.js at the max view**

In `public/js/sim.js`: change the import on line 2 to `import { VIEWS, FAR_KM } from './config.js'`. Replace every `DECK` with `VIEWS.max` (default params on lines 15, 22, 36, and the direct references on lines 60-64). Ships then populate the full sweep so both views are filled.

- [ ] **Step 9: Point weather.js default coords at the default view**

In `public/js/weather.js`: change line 1 to `import { VIEWS, DEFAULT_VIEW, LANDFALL, SIGHTLINE } from './config.js'` and line 30 to `export async function fetchWeather(lat = VIEWS[DEFAULT_VIEW].lat, lon = VIEWS[DEFAULT_VIEW].lon) {`.

- [ ] **Step 10: Read the active view in scene.js, ships.js, main.js**

- `public/js/scene.js` line 1: `import { LANDFALL } from './config.js'` and add `import { activeView } from './view.js'`. Replace `DECK.viewBearing`/`DECK.fov` (lines 72, 228-230, 244) with `activeView().viewBearing`/`activeView().fov` (read into a local `const v = activeView()` at the top of `drawClouds`, `drawCompass`, `drawLandfall`).
- `public/js/ships.js` line 1: drop `DECK` from the import, add `import { activeView } from './view.js'`. Lines 171/174: use `activeView().height` and `activeView().fov`.
- `public/js/main.js` line 1: drop `DECK`, keep `USE_SIM, EXAGGERATION, NEAR_KM, FAR_KM`; add `import { activeView } from './view.js'`. In `frame()` add `const v = activeView()` near the top and replace `DECK.lat/lon/viewBearing/fov` (lines 99-100, 138-141) with `v.lat/v.lon/v.viewBearing/v.fov`.

- [ ] **Step 11: Add the view toggle (ui.js + index.html)**

In `public/index.html`, inside the `#see` panel after the `#live` button block, add:

```html
    <div class="btns">
      <button id="view-toggle">🔭 Full sweep</button>
    </div>
```

In `public/js/ui.js`, add and export:

```js
import { activeViewName, setView, onViewChange } from './view.js'

// Wire the main↔max toggle. Button label shows the view you'll switch TO.
export function initViewToggle() {
  const btn = document.getElementById('view-toggle')
  if (!btn) return
  const sync = () => { btn.textContent = activeViewName() === 'main' ? '🔭 Full sweep' : '🏠 Main' }
  btn.addEventListener('click', () => setView(activeViewName() === 'main' ? 'max' : 'main'))
  onViewChange(sync)
  sync()
}
```

(Keep `ui.js`'s existing `import { LANDFALL } from './config.js'`; add the new import line above it.)

In `public/js/main.js`, import `initViewToggle` from `./ui.js` and call `initViewToggle()` once near `initControls(...)`.

- [ ] **Step 12: Run the full test suite**

Run: `npm test`
Expected: all tests PASS (the prior 68 + 3 new view tests + 1 landfall test).

- [ ] **Step 13: Visual check**

User runs `npm start`, opens `http://localhost:5173`. Confirm: opens in the narrow Main view (ships look bigger than before), the 🔭 button switches to the Full sweep (wider, more ships, ships smaller), compass strip rescales, Venezuela ridge visible in both. Switching back returns to Main.

- [ ] **Step 14: Commit**

```bash
git add public/js/config.js public/js/view.js public/js/view.test.js public/js/geometry.test.js public/js/sim.js public/js/weather.js public/js/scene.js public/js/ships.js public/js/ui.js public/js/main.js public/index.html
git commit -m "feat: two-view system (narrow main + wide max) on the canvas renderer"
```

---

## Task 2: Vendor Three.js + WebGL canvas bootstrap

Add the library and a blank WebGL canvas behind the existing 2D scene. The app keeps rendering exactly as before; we only prove Three loads and clears a frame.

**Files:**
- Create: `public/vendor/three/three.module.js`, `Sky.js`, `Water.js`, `waternormals.jpg`, `README.md`
- Modify: `public/index.html`
- Create: `public/js/world.js` (minimal bootstrap)
- Modify: `public/js/main.js`

> **Network note:** vendoring needs a one-time fetch from the npm registry. If the sandbox firewall blocks it, request access to `registry.npmjs.org:443` (or the user drops the files in manually).

- [ ] **Step 1: Fetch and vendor Three.js r0.160.0**

```bash
npm pack three@0.160.0
tar -xf three-0.160.0.tgz
mkdir -p public/vendor/three
cp package/build/three.module.js public/vendor/three/three.module.js
cp package/examples/jsm/objects/Sky.js public/vendor/three/Sky.js
cp package/examples/jsm/objects/Water.js public/vendor/three/Water.js
cp package/examples/textures/waternormals.jpg public/vendor/three/waternormals.jpg
rm -rf package three-0.160.0.tgz
```

`Sky.js` and `Water.js` import from the bare specifier `'three'`; the importmap (next step) resolves that to the vendored file, so all code shares one THREE instance. If the addons import from a relative `../../../build/three.module.js`, edit their import line to `from 'three'`.

- [ ] **Step 2: Write the vendor README**

Create `public/vendor/three/README.md`:

```markdown
# Vendored Three.js

- Version: r0.160.0 (pinned; do not "upgrade in place" without re-testing).
- Source: npm `three@0.160.0` — `build/three.module.js`,
  `examples/jsm/objects/{Sky,Water}.js`, `examples/textures/waternormals.jpg`.
- Imported via the importmap in `public/index.html` (`"three"` → this folder).
- Vendored (not CDN) so BB45 works fully offline / over flaky island internet / via file://.
```

- [ ] **Step 3: Add the importmap, WebGL canvas, and overlay canvas to index.html**

In `public/index.html`, replace the single `<canvas id="view">` with two stacked canvases and add the importmap before the module script:

```html
  <canvas id="gl"></canvas>
  <canvas id="overlay"></canvas>
```

Update the `<style>` so both fill the viewport and stack (gl below, overlay above; overlay must not eat pointer events meant for nothing — it does need them for hover, so keep it interactive):

```css
    #gl, #overlay { position: fixed; inset: 0; display: block; width: 100vw; height: 100vh; }
    #gl { z-index: 0; }
    #overlay { z-index: 1; }
    .panel { z-index: 2; }   /* panels already fixed; ensure above both canvases */
    #tooltip { z-index: 3; }
```

Add the importmap just before `<script type="module" src="js/main.js">`:

```html
  <script type="importmap">
  { "imports": { "three": "./vendor/three/three.module.js" } }
  </script>
```

- [ ] **Step 4: Minimal world.js that clears a frame**

Create `public/js/world.js`:

```js
import * as THREE from 'three'

// Owns the WebGL renderer + scene. Task 2 only proves it loads and clears.
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0c1014)

  function resize(w, h) { renderer.setSize(w, h, false) }
  function render() { /* projection added in Task 3 */ }

  return { renderer, scene, resize, render }
}
```

- [ ] **Step 5: Wire main.js to create the world and split the canvases**

In `public/js/main.js`: the existing `canvas`/`ctx` become the OVERLAY (`document.getElementById('overlay')`). Add `import { createWorld } from './world.js'`, create `const gl = document.getElementById('overlay')`-style wiring:

```js
const overlay = document.getElementById('overlay')
const ctx = overlay.getContext('2d')
const world = createWorld(document.getElementById('gl'))
```

In `resize()`, also size the world: `world.resize(W, H)`. Everything else still draws to `ctx` (the overlay) for now — the 2D scene renders on top of the cleared WebGL background, so the app looks unchanged except the background color shows at the edges briefly.

- [ ] **Step 6: Visual check**

`npm start` → the scene still renders (now on the overlay canvas) and nothing is broken. Open devtools: no module/import errors, `three` resolves from `./vendor/three/three.module.js`.

- [ ] **Step 7: Commit**

```bash
git add public/vendor/three public/index.html public/js/world.js public/js/main.js
git commit -m "build: vendor three.js r0.160.0 (local, no CDN) + WebGL canvas bootstrap"
```

---

## Task 3: ENU + projection math + perspective view + sea

Stand up the real perspective camera over a water plane for the `main` view, driven by the active view. TDD the math; verify the sea visually.

**Files:**
- Modify: `public/js/geometry.js`, `public/js/geometry.test.js`
- Create: `public/js/projection-math.js`, `public/js/projection-math.test.js`
- Create: `public/js/projections.js`
- Modify: `public/js/world.js`, `public/js/main.js`

- [ ] **Step 1: Write the failing enu() test**

Append to `public/js/geometry.test.js`:

```js
test('enu maps lat/lon to local east/north metres', () => {
  const o = { lat: 12.135972, lon: -68.989167 }
  assert.deepEqual(enu(o.lat, o.lon, o.lat, o.lon), { e: 0, n: 0 })
  const north = enu(o.lat + 0.01, o.lon, o.lat, o.lon)
  assert.ok(Math.abs(north.n - 1112) < 1 && Math.abs(north.e) < 1e-6)
  const east = enu(o.lat, o.lon + 0.01, o.lat, o.lon)
  assert.ok(Math.abs(east.e - 1087) < 1 && Math.abs(east.n) < 1e-6)
})
```

Add `enu` to the geometry import at the top of the test file.

- [ ] **Step 2: Run — confirm it fails**

Run: `npm test`
Expected: FAIL — `enu is not a function`.

- [ ] **Step 3: Implement enu()**

Append to `public/js/geometry.js`:

```js
// Local tangent-plane (equirectangular) projection of lat/lon to east/north
// metres about an origin. Accurate to well under a metre over the ~40 km view.
export function enu(lat, lon, lat0, lon0) {
  const e = toRad(lon - lon0) * Math.cos(toRad(lat0)) * R_KM * 1000
  const n = toRad(lat - lat0) * R_KM * 1000
  return { e, n }
}
```

- [ ] **Step 4: Run — confirm it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the failing projection-math tests**

Create `public/js/projection-math.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vFovFromHFov, fogDensity, bearingOfDir, cylindricalProject } from './projection-math.js'

test('vFovFromHFov inverts via aspect', () => {
  assert.ok(Math.abs(vFovFromHFov(90, 1) - 90) < 1e-6)
  assert.ok(Math.abs(vFovFromHFov(90, 2) - 53.130) < 1e-3)
})

test('fogDensity from Koschmieder sightline (per metre)', () => {
  assert.ok(Math.abs(fogDensity(40) - 3.912 / 40000) < 1e-12)
  assert.ok(fogDensity(10) > fogDensity(40)) // hazier air = denser fog
})

test('bearingOfDir reads compass bearing from an ENU/THREE dir', () => {
  assert.ok(Math.abs(bearingOfDir({ x: 0, y: 0, z: -1 }) - 0) < 1e-6)   // north (-Z)
  assert.ok(Math.abs(bearingOfDir({ x: 1, y: 0, z: 0 }) - 90) < 1e-6)   // east (+X)
})

test('cylindricalProject maps azimuth linearly across the fov', () => {
  const v = { viewBearing: 219.5, fov: 71 }, W = 1000, horizonY = 300
  const ahead = cylindricalProject({ x: Math.sin(219.5 * Math.PI / 180), y: 0,
    z: -Math.cos(219.5 * Math.PI / 180) }, v, W, horizonY)
  assert.ok(ahead.visible && Math.abs(ahead.x - 500) < 1e-3 && Math.abs(ahead.y - 300) < 1e-3)
  const rightEdge = cylindricalProject({ x: Math.sin(255 * Math.PI / 180), y: 0,
    z: -Math.cos(255 * Math.PI / 180) }, v, W, horizonY)
  assert.ok(rightEdge.visible && Math.abs(rightEdge.x - 1000) < 1e-2)
  const behind = cylindricalProject({ x: Math.sin(40 * Math.PI / 180), y: 0,
    z: -Math.cos(40 * Math.PI / 180) }, v, W, horizonY)
  assert.equal(behind.visible, false)
})
```

- [ ] **Step 6: Run — confirm it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './projection-math.js'`.

- [ ] **Step 7: Implement projection-math.js**

Create `public/js/projection-math.js`:

```js
import { toDeg, toRad, normalizeSigned } from './geometry.js'

// Convert a horizontal FOV (deg) to Three's vertical FOV (deg) for an aspect w/h.
export function vFovFromHFov(hFovDeg, aspect) {
  return toDeg(2 * Math.atan(Math.tan(toRad(hFovDeg) / 2) / aspect))
}

// FogExp2 density (per metre) from the Koschmieder sightline (km): the range at
// which contrast falls to ~2% (ln(0.02) ≈ -3.912). World units are metres.
export function fogDensity(sightlineKm) {
  return 3.912 / (Math.max(0.1, sightlineKm) * 1000)
}

// Compass bearing (deg 0..360, 0=N, 90=E) of a direction in ENU/THREE axes
// (x=east, y=up, z=-north).
export function bearingOfDir(d) {
  return (toDeg(Math.atan2(d.x, -d.z)) + 360) % 360
}

// Cylindrical (equidistant) world→screen for the wide view: azimuth linear in x
// across the fov, elevation linear in y (isotropic px/deg). Mirrors the composite
// shader so HUD/tooltips line up with what's drawn. d is a dir from the eye.
export function cylindricalProject(d, view, W, horizonY) {
  const relAz = normalizeSigned(bearingOfDir(d) - view.viewBearing)
  const horiz = Math.hypot(d.x, d.z)
  const elDeg = toDeg(Math.atan2(d.y, horiz))
  const pxPerDeg = W / view.fov
  return {
    x: W * (0.5 + relAz / view.fov),
    y: horizonY - elDeg * pxPerDeg,
    visible: Math.abs(relAz) <= view.fov / 2
  }
}
```

- [ ] **Step 8: Run — confirm it passes**

Run: `npm test`
Expected: all projection-math tests PASS.

- [ ] **Step 9: Add the Projection interface + PerspectiveProjection**

Create `public/js/projections.js`:

```js
import * as THREE from 'three'
import { toRad } from './geometry.js'
import { vFovFromHFov } from './projection-math.js'

// Perspective projection for the narrow main view: a plain PerspectiveCamera.
// eyeENU = {e, n} of the viewpoint relative to the world origin; heightM above sea.
export class PerspectiveProjection {
  constructor(view, eyeENU) {
    this.view = view
    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 80000)
    this.camera.position.set(eyeENU.e, view.height, -eyeENU.n)
    // Yaw to the view bearing (0=N=-Z, +X=E), level pitch.
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = -toRad(view.viewBearing)
  }
  resize(w, h) {
    this.camera.aspect = w / h
    this.camera.fov = vFovFromHFov(this.view.fov, w / h)
    this.camera.updateProjectionMatrix()
    this._w = w; this._h = h
  }
  render(renderer, scene) { renderer.render(scene, this.camera) }
  // World position → screen px (CSS pixels). visible=false when off-screen/behind.
  project(worldPos) {
    const v = worldPos.clone().project(this.camera)
    return {
      x: (v.x * 0.5 + 0.5) * this._w,
      y: (-v.y * 0.5 + 0.5) * this._h,
      visible: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1
    }
  }
}
```

- [ ] **Step 10: Build the sea + origin in world.js**

Rewrite `public/js/world.js` to own the origin, a water plane, and an active projection:

```js
import * as THREE from 'three'
import { Water } from './vendor/three/Water.js'   // NOTE: relative path, see step note
import { enu } from './geometry.js'
import { VIEWS, DEFAULT_VIEW } from './config.js'
import { PerspectiveProjection } from './projections.js'

const ORIGIN = { lat: VIEWS[DEFAULT_VIEW].lat, lon: VIEWS[DEFAULT_VIEW].lon }
export function viewEye(view) { return enu(view.lat, view.lon, ORIGIN.lat, ORIGIN.lon) }

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()

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
  scene.background = new THREE.Color(0x8fb6e6)

  let projection = null
  function setProjection(view) { projection = new PerspectiveProjection(view, viewEye(view)); if (W) projection.resize(W, H) }
  let W = 0, H = 0
  function resize(w, h) { W = w; H = h; renderer.setSize(w, h, false); if (projection) projection.resize(w, h) }
  function render(t) { water.material.uniforms.time.value = t * 0.0005; if (projection) projection.render(renderer, scene) }

  return { renderer, scene, water, setProjection, getProjection: () => projection, resize, render }
}
```

> The `Water` import path: if `Water.js` imports `from 'three'` it must be imported here as `from './vendor/three/Water.js'` (a real path), which is correct above. Keep our own modules importing `'three'` (the importmap) so everything shares one instance.

- [ ] **Step 11: Drive the world from main.js**

In `public/js/main.js`: after creating `world`, call `world.setProjection(activeView())` and, via `onViewChange`, re-run `world.setProjection(v)`. In `frame(t)`, call `world.render(t)` BEFORE drawing the overlay. For this task, keep the old 2D sky/sea draws but stop them from fully covering the WebGL by **not** calling `drawSky`/`drawSea` (comment them out) so the 3D water shows; keep `drawDeck`/`drawPalms`/`drawCompass` and ships for now.

- [ ] **Step 12: Visual check**

`npm start` → a real reflective water plane fills the lower screen with a perspective horizon at ~mid-screen; switching to Full sweep moves the camera/raises the FOV (edges will look stretched until Task 7 — expected). Ships/deck still draw on the overlay (positions will be wrong until Task 5 — expected).

- [ ] **Step 13: Run tests + commit**

```bash
npm test   # all pass (render code not under test)
git add public/js/geometry.js public/js/geometry.test.js public/js/projection-math.js public/js/projection-math.test.js public/js/projections.js public/js/world.js public/js/main.js
git commit -m "feat: ENU coords, perspective projection, three.js reflective sea (main view)"
```

---

## Task 4: Sky + sun + fog (main view)

Replace the 2D sky with Three's `Sky`, place the sun from the real azimuth/elevation already computed in `sky.js`, and add `FogExp2` from the sightline.

**Files:**
- Modify: `public/js/world.js`, `public/js/main.js`

- [ ] **Step 1: Add Sky, a sun light, and fog to world.js**

Add imports and scene objects in `createWorld`:

```js
import { Sky } from './vendor/three/Sky.js'
import { fogDensity } from './projection-math.js'
// ... inside createWorld, after water:
const sky = new Sky(); sky.scale.setScalar(60000); scene.add(sky)
sky.material.uniforms.turbidity.value = 8
sky.material.uniforms.rayleigh.value = 2
sky.material.uniforms.mieCoefficient.value = 0.005
sky.material.uniforms.mieDirectionalG.value = 0.8
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0); scene.add(sunLight)
scene.add(new THREE.AmbientLight(0xffffff, 0.3))
scene.fog = new THREE.FogExp2(0x9fb6c8, fogDensity(40))
const sunV = new THREE.Vector3()
```

- [ ] **Step 2: Add an updateEnv() that drives sun + fog from real data**

Add to `createWorld` and return it:

```js
import { toRad } from './geometry.js'
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
```

Return `updateEnv` from `createWorld`.

- [ ] **Step 3: Feed real sun + sightline from main.js**

In `frame()`, build the env values already available (`sp` from `sunPosition(now, v.lat, v.lon)` and `effSl`) and call:

```js
world.updateEnv({ sunAz: sp.azimuth, sunEl: sp.elevation, sightlineKm: effSl })
```

Stop calling the old `drawStars`/`drawMoon`/`drawClouds`/`drawLandfall` (comment out — re-added natively in Task 8 / handled by fog). Keep deck/palms/compass/ships on the overlay.

- [ ] **Step 4: Visual check**

`npm start` at different times of day: sky color + sun position track the real sun; the sea reflects sun glint toward the real azimuth; dragging the sightline slider thickens/thins the haze toward the horizon (the Venezuela ridge area fades with low sightline).

- [ ] **Step 5: Commit**

```bash
git add public/js/world.js public/js/main.js
git commit -m "feat: three.js sky + real sun + FogExp2 from the koschmieder sightline"
```

---

## Task 5: Ships as fogged billboard sprites (main view)

Ships become `THREE.Sprite`s textured from the existing per-type silhouettes, placed at true ENU positions, scaled to real length, naturally fogged. Hover/tooltips use `projection.project()`.

**Files:**
- Modify: `public/js/ships.js` (export the painters)
- Create: `public/js/ship-sprites.js`
- Modify: `public/js/world.js`, `public/js/main.js`

- [ ] **Step 1: Export the silhouette painters from ships.js**

In `public/js/ships.js`, add `export` to the `SILHOUETTES` const (line 65) and to `shipPalette` (line 50) and `lodDetail` (line 36). Keep `drawShip` for now (removed at cleanup).

- [ ] **Step 2: Implement ship-sprites.js (silhouette → texture → sprite)**

Create `public/js/ship-sprites.js`:

```js
import * as THREE from 'three'
import { SILHOUETTES, shipPalette, lodDetail } from './ships.js'
import { hullDownState } from './geometry.js'

const TEX_W = 256                       // texture resolution; silhouette drawn into the top
// Render a ship's silhouette into an offscreen canvas, cropping the lower hull by
// clipFrac (hull-down) so only the superstructure shows. Returns a CanvasTexture.
export function shipTexture(ship, ambient, clipFrac) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_W
  const ctx = c.getContext('2d')
  const w = TEX_W * 0.92, baseY = TEX_W * 0.78   // waterline near the lower third
  ctx.save(); ctx.translate((TEX_W - w) / 2, baseY)
  if (clipFrac > 0) {                            // clip away the submerged hull
    const shdH = w * 0.5
    ctx.beginPath(); ctx.rect(-w, -shdH * 2, w * 3, shdH * 2 - clipFrac * shdH); ctx.clip()
  }
  ;(SILHOUETTES[ship.type] || SILHOUETTES.coaster)(ctx, w, lodDetail(120), shipPalette(ambient))
  ctx.restore()
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  return { tex, baseFrac: baseY / TEX_W }
}

// Build (or refresh) a sprite for a ship and place it. lenM real length; the sprite
// world height is scaled from length by the silhouette's aspect.
export function makeShipSprite() {
  const mat = new THREE.SpriteMaterial({ fog: true, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  return sprite
}
```

- [ ] **Step 3: Add a ship layer to world.js**

In `createWorld`, add a sprite pool keyed by ship id and an `updateShips(ships, env, deckHeight)`:

```js
import { makeShipSprite, shipTexture } from './ship-sprites.js'
import { hullDownState } from './geometry.js'
import { SUPERSTRUCTURE_M } from './config.js'
// ...
const shipLayer = new THREE.Group(); scene.add(shipLayer)
const sprites = new Map()
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
    const { tex } = shipTexture(s, env.ambient, hd.clipFrac)
    if (sp.material.map) sp.material.map.dispose()
    sp.material.map = tex; sp.material.needsUpdate = true
    sp.userData.ship = s; sp.userData.hullDown = hd.state === 'hulldown'
  }
  for (const [id, sp] of sprites) if (!seen.has(id)) { shipLayer.remove(sp); if (sp.material.map) sp.material.map.dispose(); sp.material.dispose(); sprites.delete(id) }
}
function shipScreenRects() {                       // for overlay hover/tooltip
  const out = []
  for (const sp of sprites.values()) {
    const p = projection.project(sp.position)
    if (p.visible) out.push({ ship: sp.userData.ship, hullDown: sp.userData.hullDown, x: p.x, y: p.y })
  }
  return out
}
```

Return `updateShips` and `shipScreenRects`.

> Texture rebuild per frame is wasteful; acceptable for the ~9-ship fleet. A later optimization: cache by `(type, ambient bucket, clipFrac bucket)`.

- [ ] **Step 4: Compute each ship's ENU + distance in main.js, then update the world**

In `frame()`, replace the overlay ship-draw block. For each ship compute distance, bearing (still stashed as `_bearing` for the tooltip), and ENU, then hand the fleet to the world:

```js
import { enu } from './geometry.js'
import { viewEye } from './world.js'   // ORIGIN-relative
// in frame():
for (const s of ships) {
  s._distanceKm = haversineKm(v.lat, v.lon, s.lat, s.lon)
  s._bearing = bearingTo(v.lat, v.lon, s.lat, s.lon)
  s._enu = enu(s.lat, s.lon, /* origin */ VIEWS.main.lat, VIEWS.main.lon)
}
world.updateShips(ships.filter(s => s._distanceKm <= Math.min(FAR_KM, sightline)), { ambient: env.ambient, deckHeight: v.height })
```

(Import `VIEWS` in main.js. The origin must match `world.js`'s ORIGIN — both use `VIEWS.main` lat/lon.)

- [ ] **Step 5: Wire hover/tooltip to projected sprite rects**

Replace the overlay's `hitRects`/`shipAtPoint` source with `world.shipScreenRects()`. Grow each rect to a min hit size (reuse `padRect` from `ships.js`, exported if needed) around `(x, y)`, run the existing sticky-hover + `showTooltip` against it. The tooltip already reads `hit.ship`, `hit.distanceKm` (set it from `ship._distanceKm`), `hit.hullDown`.

- [ ] **Step 6: Visual check**

`npm start` → ships sit on the water at their true bearing and distance, near ones large and low, far ones small near the horizon and hazed by fog; distant ones go hull-down (superstructure only); hovering shows the tooltip; types look distinct. Switch to Full sweep — ships still placed correctly (edge stretch remains until Task 7).

- [ ] **Step 7: Commit**

```bash
git add public/js/ships.js public/js/ship-sprites.js public/js/world.js public/js/main.js
git commit -m "feat: ships as fogged billboard sprites at true ENU positions (main view)"
```

---

## Task 6: Foreground overlay (deck, palms, compass)

Move the foreground painters into a dedicated overlay module; the overlay canvas now draws only HUD/foreground.

**Files:**
- Create: `public/js/overlay.js`
- Modify: `public/js/main.js`, `public/js/scene.js`

- [ ] **Step 1: Create overlay.js re-exporting the foreground draws**

Create `public/js/overlay.js`:

```js
import { drawDeck, drawPalms, drawCompass } from './scene.js'

// Draw the 2D foreground/HUD on the transparent overlay canvas, on top of the
// WebGL world. Order: compass (just above the stone), deck stone+glass, palms.
export function drawOverlay(ctx, W, H, t) {
  drawCompass(ctx, W, H)
  drawDeck(ctx, W, H)
  drawPalms(ctx, W, H, t)
}
```

- [ ] **Step 2: Use it in main.js**

In `frame()`, after `world.render(t)` and the ship-rect/tooltip handling, replace the individual `drawDeck/drawPalms/drawCompass` calls with `drawOverlay(ctx, W, H, t)` (import it). Ensure `ctx.clearRect(0,0,W,H)` still runs first so the overlay is transparent over the WebGL canvas.

- [ ] **Step 3: Visual check**

`npm start` → travertine deck, frameless-glass tint, corner palms, and the compass strip render crisply over the 3D world; the compass ticks line up with ship bearings in the Main view.

- [ ] **Step 4: Commit**

```bash
git add public/js/overlay.js public/js/main.js
git commit -m "refactor: 2D deck/palms/compass move to a foreground overlay layer"
```

---

## Task 7: Cylindrical projection for the wide (max) view

Render the wide view through a cube render target sampled by a cylindrical composite, so the full 156° is faithful (straight verticals, arc horizon, no edge-stretch).

**Files:**
- Modify: `public/js/projections.js`, `public/js/world.js`, `public/js/main.js`

- [ ] **Step 1: Implement CylindricalProjection (cube → composite)**

Add to `public/js/projections.js`:

```js
import { toRad } from './geometry.js'
import { cylindricalProject } from './projection-math.js'

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
  }
  resize(w, h) { this._w = w; this._h = h; this.mat.uniforms.fovY.value = toRad(this.view.fov) * (h / w) }
  render(renderer, scene) {
    const prevFog = scene.fog
    this.cubeCam.update(renderer, scene)
    renderer.render(this.quadScene, this.quadCam)
    scene.fog = prevFog
  }
  project(worldPos) {
    const d = worldPos.clone().sub(this.eye)
    return cylindricalProject({ x: d.x, y: d.y, z: d.z }, this.view, this._w, this._h * 0.5 / (this.view.fov / this.view.fov))
      // horizonY = H/2 (level camera); simplify:
  }
}
```

Fix `project()` to a clean form (horizon at mid-screen):

```js
  project(worldPos) {
    const d = worldPos.clone().sub(this.eye)
    const p = cylindricalProject({ x: d.x, y: d.y, z: d.z }, this.view, this._w, this._h / 2)
    return p
  }
```

> `cylindricalProject` uses `pxPerDeg = W/fov` for the vertical too; with `fovY = fovX·(h/w)` the composite is isotropic and the horizon sits at `H/2`, matching `project()`'s `horizonY = H/2`.

- [ ] **Step 2: Select the projection by view in world.js**

In `world.js` `setProjection(view)`, choose the class by fov/name:

```js
import { CylindricalProjection } from './projections.js'
function setProjection(view) {
  projection = view.fov > 100
    ? new CylindricalProjection(view, viewEye(view))
    : new PerspectiveProjection(view, viewEye(view))
  if (W) projection.resize(W, H)
}
```

- [ ] **Step 3: Visual check (both views)**

`npm start`, Main view: unchanged crisp perspective. Switch to Full sweep: the full 145°→301° sweep shows with **straight verticals and no edge-stretch**, the horizon a gentle arc; ships across the whole arc sit at the right bearings; fog/haze still reads; the Venezuela ridge is in frame at the right. Hover/tooltips line up in both views.

- [ ] **Step 4: Performance gate / fallback**

If the cube render makes the wide view drop below ~30 fps on the user's machine, **STOP and flag it** — do not silently narrow. The flagged fallback (separate decision) is to cap `max` at ~110° using `PerspectiveProjection`. Report fps before choosing.

- [ ] **Step 5: Commit**

```bash
git add public/js/projections.js public/js/world.js public/js/main.js
git commit -m "feat: cylindrical render-to-target projection for the wide (max) view"
```

---

## Task 8: Night sky + wind-driven water

Add the night side (stars + real-phase moon) crossfaded by sun elevation, and drive water motion from the real wind.

**Files:**
- Modify: `public/js/world.js`, `public/js/main.js`

- [ ] **Step 1: Add a starfield + moon to world.js**

```js
// Fixed starfield as Points on a large sphere; opacity driven by env.starAlpha.
const starGeo = new THREE.BufferGeometry()
const starN = 1200, pos = new Float32Array(starN * 3)
for (let i = 0; i < starN; i++) {
  const u = i / starN, th = u * Math.PI * 2 * 97.3, ph = Math.acos(2 * ((i * 0.6180339) % 1) - 1)
  const R = 50000
  pos[i*3] = R*Math.sin(ph)*Math.cos(th); pos[i*3+1] = Math.abs(R*Math.cos(ph)); pos[i*3+2] = R*Math.sin(ph)*Math.sin(th)
}
starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfffff5, size: 120, sizeAttenuation: true, transparent: true, opacity: 0, fog: false }))
scene.add(stars)
```

(Generating star positions with a deterministic sequence avoids `Math.random()` at module load.)

- [ ] **Step 2: Crossfade night + drive water from wind in updateEnv()**

Extend `updateEnv(env)`:

```js
stars.material.opacity = env.starAlpha ?? 0
sky.visible = (env.starAlpha ?? 0) < 0.95          // hide daytime sky at deep night
const windScale = 0.5 + (env.windKn ?? 6) / 12     // stronger wind = choppier water
water.material.uniforms.distortionScale.value = 3.0 * windScale
```

- [ ] **Step 3: Feed starAlpha + wind from main.js**

`world.updateEnv({ sunAz, sunEl, sightlineKm, starAlpha: env.starAlpha, ambient: env.ambient, windKn: wx?.windKn })` — `env.starAlpha`/`ambient` already come from `skyState(sp.elevation)`.

- [ ] **Step 4: Visual check**

`npm start` after sunset: sky darkens, stars fade in, water calms/roughens with the live wind reading; daytime returns the blue sky and sun glint. (A real-phase moon sprite can be added the same way as stars if desired; note if deferred.)

- [ ] **Step 5: Commit**

```bash
git add public/js/world.js public/js/main.js
git commit -m "feat: night starfield crossfade + wind-driven water motion"
```

---

## Task 9: Cleanup + spec finalize

Remove the dead 2D scene/ship code now that the 3D path owns rendering.

**Files:**
- Modify: `public/js/scene.js`, `public/js/ships.js`, `public/js/config.js`, `public/js/main.js`
- Modify: `docs/superpowers/specs/2026-06-14-threejs-3d-migration.md`

- [ ] **Step 1: Delete superseded 2D draws**

From `public/js/scene.js` remove `drawSky`, `drawSea`, `drawClouds`, `drawStars`, `drawMoon`, `drawLandfall`, `horizonY`, and the now-unused helpers (`horizonPath`, `curveDip`, `rgba`, star/moon state). Keep `drawDeck`, `drawPalms`, `drawCompass` (used by `overlay.js`).

- [ ] **Step 2: Retire the canvas drawShip**

From `public/js/ships.js` remove `drawShip` and `hazeAlpha` (the sprite path replaces them). Keep the exported `SILHOUETTES`, `shipPalette`, `lodDetail`, `nightLift`, `padRect`, `shipAtPoint`, `mix`/`hex` as still used. Run `npm test` — `ships.test.js` must still pass (it tests the pure helpers, not `drawShip`); if it referenced `drawShip`, delete those cases.

- [ ] **Step 3: Retire EXAGGERATION**

Remove `EXAGGERATION` from `public/js/config.js` and its import/use in `public/js/main.js` (the perspective camera replaces the stylized drop).

- [ ] **Step 4: Remove dead imports in main.js**

Delete imports no longer used (`drawSky`, `drawSea`, `projectCelestial`, `moonArc`, `projectX`, etc.). Run the app to confirm no missing-symbol errors.

- [ ] **Step 5: Finalize the spec status**

In the spec, set `Status: implemented` and add a one-line note recording the actual Three.js version and whether the cylindrical path shipped or the ~110° fallback was used.

- [ ] **Step 6: Full test run + visual check + commit**

```bash
npm test   # all green
```

Visual: Main + Full sweep both correct, day + night, ships + tooltips, deck/palms/compass.

```bash
git add public/js/scene.js public/js/ships.js public/js/config.js public/js/main.js docs/superpowers/specs/2026-06-14-threejs-3d-migration.md
git commit -m "chore: remove superseded 2D scene/ship renderer; finalize migration spec"
```

---

## Self-review notes

- **Spec coverage:** two-view config + toggle (T1) ✓; vendored Three (T2) ✓; ENU + perspective + sea (T3) ✓; sky/sun/fog from sightline (T4) ✓; sprite ships + hull-down + hover (T5) ✓; foreground overlay (T6) ✓; cylindrical max + flagged fallback (T7) ✓; night + wind water (T8) ✓; cleanup + superseded-stance note (T9) ✓. Landfall-in-frame guarded (T1). `EXAGGERATION` retired (T9).
- **Deferred (spec "out of scope"):** 3D meshes for near ships; Marine API waves; m5 identity; glanceable on-ship info. A real-phase moon sprite is optional in T8 (flag if deferred).
- **Type/name consistency:** `activeView`/`setView`/`onViewChange` (T1) used in T3/T5/T7; `viewEye`/`ORIGIN` shared by `world.js` and `main.js` (both `VIEWS.main` lat/lon); `Projection` shape `{resize, render, project}` honored by both classes; `fogDensity`/`cylindricalProject` shared by math + shader; ship fields `_distanceKm`/`_bearing`/`_enu` set in `main.js` and read in `world.js`/`ui.js`.
- **Known rough edges (acceptable for v1, noted in-task):** per-frame ship texture rebuild (T5 note); horizon fixed at mid-screen in 3D (more realistic than the old 0.42; deck overlay covers the base); cube render perf has an explicit fps gate + flagged fallback (T7).
```
