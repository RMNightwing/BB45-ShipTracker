# Static Perceptual Ship Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the optically-faithful ship size/spread/haze with a perceptual model — size by size-constancy, vertical spread decoupled from size, gentler distance haze with a legibility floor — all tunable by eye via three live "Calibration" sliders, with bearing kept exact.

**Architecture:** A new pure module `perception.js` holds the three rules as unit-tested functions. `world.js` calls them per ship to set position (depth rule, along the true bearing), mesh scale (size rule), and per-ship haze tint (haze rule, ships opt out of scene fog). `config.js` holds the baked default constants; a "Calibration" slider group in the panel overrides them live via `main.js` → `updateShips`.

**Tech Stack:** Vanilla JS ES modules, Three.js r160 (vendored, bare `three` via importmap), `node --test`.

**Key conventions:**
- `perception.js` and `geometry.js` are pure (no `three`) → unit-tested under `node --test`. `world.js`/`projections.js`/`ship-meshes.js` import `three` (browser-only) → verified visually; validate syntax with `node --check`.
- Mesh local frame: X=beam, Y=up (waterline y=0), Z=length (bow −Z). Ship length ≈ `len` metres along Z.
- Size rule outputs a **target angular size in radians**; `world.js` converts it to mesh scale via `scale = angle · dPrimeMetres / len` (small-angle), so the rendered ship subtends that angle at its placed distance regardless of the depth nudge.
- This supersedes the prior fan-out: `DEPTH_SPREAD` replaces `EXAGGERATION`, and `fannedPlacement` (which coupled size to position) is removed — size and vertical position are now independent.

---

### Task 1: `perception.js` — the three rules + tests

**Files:**
- Create: `public/js/perception.js`
- Test: `public/js/perception.test.js`

- [ ] **Step 1: Write the failing tests**

Create `public/js/perception.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apparentAngle, renderedDistanceKm, shipClarity } from './perception.js'

// --- apparentAngle ---
test('apparentAngle grows with length and shrinks with distance (partial constancy)', () => {
  const big = apparentAngle(300, 10, 0.0016, 0.4, 0.001, 1)
  const small = apparentAngle(100, 10, 0.0016, 0.4, 0.001, 1)
  assert.ok(big > small)                                   // longer ship → larger
  const near = apparentAngle(200, 3, 0.0016, 0.4, 0.001, 1)
  const far = apparentAngle(200, 20, 0.0016, 0.4, 0.001, 1)
  assert.ok(near > far)                                    // nearer → larger
})

test('apparentAngle at constancy 0 is pure optics (∝ length/distance)', () => {
  const a = apparentAngle(200, 10, 0.0016, 0, 0, 10)
  assert.ok(Math.abs(a - 0.0016 * 200 / 10) < 1e-9)
})

test('apparentAngle at constancy 1 is distance-independent', () => {
  const near = apparentAngle(200, 2, 0.0016, 1, 0, 10)
  const far = apparentAngle(200, 38, 0.0016, 1, 0, 10)
  assert.equal(near, far)
  assert.ok(Math.abs(near - 0.0016 * 200) < 1e-9)
})

test('apparentAngle respects the min floor and max cap', () => {
  assert.equal(apparentAngle(10, 39, 0.0016, 0.4, 0.05, 0.5), 0.05)   // tiny far → floor
  assert.equal(apparentAngle(400, 0.5, 0.0016, 0.4, 0.01, 0.2), 0.2)  // huge near → cap
})

// --- renderedDistanceKm ---
test('renderedDistanceKm equals true distance when spread is 0', () => {
  assert.equal(renderedDistanceKm(12, 0, 2, 40), 12)
})

test('renderedDistanceKm pulls nearer ships in and never exceeds true distance', () => {
  const d = renderedDistanceKm(5, 0.7, 2, 40)
  assert.ok(d > 0 && d < 5)
  const dFar = renderedDistanceKm(38, 0.7, 2, 40)
  assert.ok(dFar <= 38)                                    // far edge barely nudged
  assert.ok(renderedDistanceKm(3, 0.7, 2, 40) / 3 < renderedDistanceKm(20, 0.7, 2, 40) / 20)
})

// --- shipClarity ---
test('shipClarity is 1 at zero distance and decreases with distance', () => {
  assert.equal(shipClarity(0, 40, 0.4, 0.35), 1)
  assert.ok(shipClarity(10, 40, 0.4, 0.35) > shipClarity(30, 40, 0.4, 0.35))
})

test('shipClarity never falls below the floor and is 1 everywhere at strength 0', () => {
  assert.ok(shipClarity(40, 40, 1, 0.35) >= 0.35 - 1e-9)
  assert.equal(shipClarity(40, 40, 1, 0.35), 0.35)
  assert.equal(shipClarity(25, 40, 0, 0.35), 1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `./perception.js`.

- [ ] **Step 3: Implement `perception.js`**

Create `public/js/perception.js`:

```js
import { nearness } from './geometry.js'

// The perceptual ship model: three rules that replace optics with how the eye reads
// the bay. Pure (no three) so they unit-test under node. See
// docs/superpowers/specs/2026-06-14-perceptual-ship-model-design.md.

// Size rule (size constancy). Returns a TARGET ANGULAR SIZE in radians. constancy 0 =
// pure optics (∝ length/distance); 1 = size depends only on length (distance
// irrelevant); ~0.4 = partial constancy (far ships lifted, nearer still larger).
// Clamped to [minA, maxA] (legibility floor / frame cap).
export function apparentAngle(lengthM, trueKm, gain, constancy, minA, maxA) {
  const d = Math.max(0.05, trueKm)
  const raw = gain * lengthM / Math.pow(d, 1 - constancy)
  return Math.min(maxA, Math.max(minA, raw))
}

// Depth/spread rule. Returns the rendered distance (km) along the true bearing ray;
// smaller = lower in the frame. spread 0 = true depression (piled at horizon); higher
// pulls nearer ships down to fan the fleet across the foreground. Never exceeds true.
export function renderedDistanceKm(trueKm, spread, nearKm, farKm) {
  return trueKm * (1 - spread * nearness(trueKm, nearKm, farKm))
}

// Haze rule. Returns clarity 0..1 (1 = crisp) from TRUE distance, gentler than optical
// fog and never below `floor`, so a ship stays a recognizable shape out to the cull.
export function shipClarity(trueKm, farKm, strength, floor) {
  const t = Math.min(1, Math.max(0, trueKm / farKm))
  return Math.max(floor, 1 - strength * (1 - floor) * t)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all new perception tests green; existing suite unaffected).

- [ ] **Step 5: Commit**

```bash
git add public/js/perception.js public/js/perception.test.js
git commit -m "feat(perception): size-constancy/spread/haze rules (pure, tested)"
```

---

### Task 2: Config constants for the perceptual model

**Files:**
- Modify: `public/js/config.js`

- [ ] **Step 1: Replace the EXAGGERATION block with the perceptual constants**

In `public/js/config.js`, find this block:

```js
// Vertical fan-out (the only stylized axis). Nearer ships are pulled closer along
// their own sight-ray so they sit lower in the frame, then scaled down by the same
// factor so bearing and apparent size stay EXACT. 0 = physically true (ships pile at
// the horizon); higher = more dramatic foreground spread. Tune by eye in-browser.
export const EXAGGERATION = 0.7
// Distance (km) at/below which a ship gets the full nudge; nearness ramps 1→0 from
// here out to FAR_KM.
export const NEAR_KM = 2
```

Replace it with:

```js
// Perceptual ship model — size/spread/haze tuned to the eye, not optics. See
// docs/superpowers/specs/2026-06-14-perceptual-ship-model-design.md. These are the
// baked defaults; the Calibration sliders override SIZE_GAIN/DEPTH_SPREAD/HAZE_STRENGTH
// live. Tune by eye against the real bay, then read the values back here.
export const SIZE_GAIN = 0.0016     // overall magnification (Size slider); absorbs units
export const SIZE_CONSTANCY = 0.4   // 0 = optics (∝1/dist); 1 = size depends only on length
export const MIN_ANGLE = 0.012      // rad: legibility floor for the farthest ship
export const MAX_ANGLE = 0.5        // rad: cap so a near ship can't swallow the frame
export const DEPTH_SPREAD = 0.7     // vertical fan (Spread slider); replaces EXAGGERATION
export const HAZE_STRENGTH = 0.4    // ship haze fade (Haze slider); 0 = crisp to the cull
export const HAZE_FLOOR = 0.35      // minimum ship clarity (never veiled)
// Distance (km) at/below which a ship gets the full depth nudge; nearness ramps 1→0
// from here out to FAR_KM.
export const NEAR_KM = 2
```

- [ ] **Step 2: Verify the suite still passes**

Run: `npm test`
Expected: PASS (no test imports `EXAGGERATION`; the constant is only used by `world.js`, fixed in Task 4). If a failure mentions `EXAGGERATION`, it is from Task 4's file not yet updated — proceed; Task 4 resolves it.

Note: `world.js` still imports `EXAGGERATION` until Task 4. `npm test` does not import `world.js`, so the suite stays green; the browser would error until Task 4. That's expected mid-plan.

- [ ] **Step 3: Commit**

```bash
git add public/js/config.js
git commit -m "feat(config): perceptual ship model constants (replaces EXAGGERATION)"
```

---

### Task 3: Remove the superseded `fannedPlacement`

**Files:**
- Modify: `public/js/geometry.js`
- Modify: `public/js/geometry.test.js`

`fannedPlacement` coupled size to vertical position. The perceptual model separates them (`renderedDistanceKm` for position, `apparentAngle` for size), so it is dead.

- [ ] **Step 1: Remove its tests first**

In `public/js/geometry.test.js`, remove the `fannedPlacement` import (it was folded into an existing `./geometry.js` import line — remove only the `fannedPlacement` name from that import, or delete the dedicated import line if it is standalone), and delete all four tests whose names start with `'fannedPlacement ...'`:
- `'fannedPlacement leaves a far-edge ship unchanged (nearness 0 → scale 1)'`
- `'fannedPlacement preserves bearing (result is colinear with eye→ship)'`
- `'fannedPlacement preserves apparent size (scale / resultDistance == 1 / trueDistance)'`
- `'fannedPlacement nudges nearer ships more (smaller scale)'`

- [ ] **Step 2: Remove the function**

In `public/js/geometry.js`, delete the entire `fannedPlacement` function and its leading comment block (the function signature is `export function fannedPlacement(eye, ship, distanceKm, exaggeration, nearKm, farKm) { ... }`). Leave `nearness` and everything else intact.

- [ ] **Step 3: Confirm it's gone and the suite passes**

Run: `grep -rn "fannedPlacement" public/js`
Expected: no matches (Task 4 removes the `world.js` import; if `world.js` still matches here, that's fine — Task 4 fixes it. The goal of this grep is to confirm `geometry.js`/`geometry.test.js` are clean).
Run: `npm test`
Expected: PASS (four fewer tests).

- [ ] **Step 4: Commit**

```bash
git add public/js/geometry.js public/js/geometry.test.js
git commit -m "chore(geometry): remove fannedPlacement (perception model supersedes it)"
```

---

### Task 4: Rewire `world.js` to the perceptual model

**Files:**
- Modify: `public/js/world.js`

- [ ] **Step 1: Update imports**

Replace:
```js
import { enu, toRad, hullDownState, fannedPlacement } from './geometry.js'
```
with:
```js
import { enu, toRad, hullDownState } from './geometry.js'
```

Replace:
```js
import { VIEWS, DEFAULT_VIEW, SUPERSTRUCTURE_M, EXAGGERATION, NEAR_KM, FAR_KM } from './config.js'
```
with:
```js
import { VIEWS, DEFAULT_VIEW, SUPERSTRUCTURE_M, NEAR_KM, FAR_KM,
  SIZE_GAIN, SIZE_CONSTANCY, MIN_ANGLE, MAX_ANGLE, DEPTH_SPREAD, HAZE_STRENGTH, HAZE_FLOOR } from './config.js'
import { apparentAngle, renderedDistanceKm, shipClarity } from './perception.js'
```

- [ ] **Step 2: Replace the `updateShips` function**

Replace the ENTIRE current `updateShips` function (from `function updateShips(ships, env) {` through its closing `}`, i.e. the block ending right before `function disposeShip(sp) {`) with exactly:

```js
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
      if (!sp || sp.userData.type !== s.type || sp.userData.len !== len) {
        if (sp) { shipLayer.remove(sp); disposeShip(sp) }
        sp = makeShipMesh(s)
        sp.userData.type = s.type; sp.userData.len = len
        sp.userData.clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        sp.userData.materials = shipMaterials(sp)
        for (const m of sp.userData.materials) {
          m.clippingPlanes = [sp.userData.clip]
          m.fog = false                                // ships use perceptual haze, not scene FogExp2
          m.userData.baseColor = m.color.clone()       // remember the un-hazed colour
          if (m.emissive) m.emissive.setHex(0x223038)  // fixed moonlit tint; only intensity varies
          m.needsUpdate = true
        }
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
        m.color.copy(m.userData.baseColor).lerp(haze, 1 - clarity)
        if (m.emissive) m.emissiveIntensity = emis
      }
      sp.userData.ship = s; sp.userData.hullDown = hd.state === 'hulldown'
    }
    for (const [id, sp] of meshes) {
      if (seen.has(id)) continue
      shipLayer.remove(sp); disposeShip(sp); meshes.delete(id)
    }
  }
```

Leave `disposeShip` and `shipScreenRects` and everything else untouched. Do NOT change the `return { ... }` line.

- [ ] **Step 3: Validate**

Run: `node --check public/js/world.js`
Expected: no output (OK).
Run: `grep -n "EXAGGERATION\|fannedPlacement" public/js/world.js`
Expected: no matches.
Run: `npm test`
Expected: PASS (85 − 4 from Task 3 + perception tests; just confirm 0 failures).

- [ ] **Step 4: Commit**

```bash
git add public/js/world.js
git commit -m "feat(world): perceptual ship size/spread/haze; ships opt out of scene fog"
```

---

### Task 5: Calibration slider markup + CSS

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add the Calibration panel**

In `public/index.html`, find the `<section id="see" class="panel">` block. Immediately AFTER its closing `</section>`, add:

```html
  <section id="cal" class="panel">
    <h2>Calibration</h2>
    <div class="row"><span>Size</span><span id="gain-val">—</span></div>
    <input id="gain" type="range" min="0.0004" max="0.005" step="0.0001" value="0.0016">
    <div class="row" style="margin-top:6px"><span>Spread</span><span id="spread-val">—</span></div>
    <input id="spread" type="range" min="0" max="0.95" step="0.05" value="0.7">
    <div class="row" style="margin-top:6px"><span>Haze</span><span id="haze-val">—</span></div>
    <input id="haze" type="range" min="0" max="1" step="0.05" value="0.4">
  </section>
```

- [ ] **Step 2: Make the Calibration sliders full-width**

In `public/index.html`, find this CSS line:
```css
    #see input[type=range] { width: 100%; }
```
Replace it with:
```css
    #see input[type=range], #cal input[type=range] { width: 100%; }
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(ui): Calibration panel with Size/Spread/Haze sliders"
```

---

### Task 6: Wire the Calibration sliders in `ui.js`

**Files:**
- Modify: `public/js/ui.js`

- [ ] **Step 1: Accept defaults and wire the three sliders**

In `public/js/ui.js`, change the `initControls` signature and body. Replace:

```js
export function initControls(onChange) {
  const state = { sightlineKm: 40, drift: true, liveWx: true, manual: false, live: false }
```
with:
```js
export function initControls(onChange, calDefaults = {}) {
  const state = { sightlineKm: 40, drift: true, liveWx: true, manual: false, live: false }
```

Then, immediately BEFORE the final `return state` of `initControls`, add:

```js
  // Calibration sliders (perceptual ship model). They only mutate state; the render
  // loop reads it next frame, so no onChange needed. Defaults come from config.js.
  const cal = [
    ['gain', 'sizeGain', v => v.toFixed(4)],
    ['spread', 'depthSpread', v => v.toFixed(2)],
    ['haze', 'hazeStrength', v => v.toFixed(2)]
  ]
  for (const [id, key, fmt] of cal) {
    const el = document.getElementById(id), lbl = document.getElementById(id + '-val')
    if (calDefaults[key] != null) el.value = calDefaults[key]
    state[key] = +el.value
    lbl.textContent = fmt(state[key])
    el.addEventListener('input', () => { state[key] = +el.value; lbl.textContent = fmt(state[key]) })
  }
```

- [ ] **Step 2: Validate**

Run: `node --check public/js/ui.js`
Expected: no output.
Run: `npm test`
Expected: PASS (ui.test.js unaffected — it tests pure helpers, not the DOM wiring).

- [ ] **Step 3: Commit**

```bash
git add public/js/ui.js
git commit -m "feat(ui): wire Size/Spread/Haze calibration sliders into controls state"
```

---

### Task 7: Feed live knobs from `main.js`

**Files:**
- Modify: `public/js/main.js`

- [ ] **Step 1: Import the config defaults**

In `public/js/main.js`, replace:
```js
import { USE_SIM, FAR_KM, VIEWS, DEFAULT_VIEW } from './config.js'
```
with:
```js
import { USE_SIM, FAR_KM, VIEWS, DEFAULT_VIEW, SIZE_GAIN, DEPTH_SPREAD, HAZE_STRENGTH } from './config.js'
```

- [ ] **Step 2: Pass defaults into initControls**

In `public/js/main.js`, find:
```js
const controls = initControls(() => {
```
and change that line to:
```js
const controls = initControls(() => {
```
…leaving the callback body unchanged, but update the CLOSING of the `initControls(...)` call to pass the defaults object as the second argument. Concretely, the call currently ends like:
```js
  syncLive(controls.live)
})
```
Change that closing to:
```js
  syncLive(controls.live)
}, { sizeGain: SIZE_GAIN, depthSpread: DEPTH_SPREAD, hazeStrength: HAZE_STRENGTH })
```

- [ ] **Step 3: Pass the live knobs into updateShips**

In `public/js/main.js`, find:
```js
  world.updateShips(
    ships.filter(s => s._distanceKm <= Math.min(FAR_KM, sightline)),
    { ambient: env.ambient, deckHeight: v.height }
  )
```
Replace with:
```js
  world.updateShips(
    ships.filter(s => s._distanceKm <= Math.min(FAR_KM, sightline)),
    { ambient: env.ambient, deckHeight: v.height,
      sizeGain: controls.sizeGain, depthSpread: controls.depthSpread, hazeStrength: controls.hazeStrength }
  )
```

- [ ] **Step 4: Validate**

Run: `node --check public/js/main.js`
Expected: no output.
Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/js/main.js
git commit -m "feat(main): feed live Calibration knobs into the ship render"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS, 0 failures. (Net test count: previous 82 − 4 fannedPlacement + 8 perception = 86; just confirm 0 failures.)

- [ ] **Step 2: Confirm no stale references**

Run: `grep -rn "EXAGGERATION\|fannedPlacement" public/js`
Expected: no matches.
Run: `node --check public/js/world.js && node --check public/js/main.js && node --check public/js/ui.js`
Expected: all OK.

- [ ] **Step 3: Visual check (user, host-side)**

User runs `npm start` and confirms in the browser:
- Ships read at a believable, glanceable size in the full-width view — no zoom — bigger/nearer ships still clearly larger.
- The fleet fans down the water; left-right (bearing) placement is unchanged from before.
- Ships stay crisp recognizable shapes out to the cull; distance softens them gently, not to invisibility.
- The three **Calibration** sliders (Size/Spread/Haze) visibly retune the look live. Find the values that match the real bay and report them to bake into `config.js`.

- [ ] **Step 4: Bake tuned values + update memory**

After the user reports their preferred slider values, set them as the `SIZE_GAIN` / `DEPTH_SPREAD` / `HAZE_STRENGTH` defaults in `config.js` (and the matching `value=` attrs in `index.html`), commit, then update the BB45 project memory: perceptual ship model BUILT, note the tuned values, and that the look-toward zoom + cylindrical projection fix remain queued.

---

## Notes for the implementer

- **Tuning knobs** in `config.js`: `SIZE_GAIN`, `SIZE_CONSTANCY`, `MIN_ANGLE`, `MAX_ANGLE`, `DEPTH_SPREAD`, `HAZE_STRENGTH`, `HAZE_FLOOR`. The three sliders drive `SIZE_GAIN`/`DEPTH_SPREAD`/`HAZE_STRENGTH`; the rest are config-only (promotable to sliders later if wanted).
- **Do NOT change** the camera/FOV (`VIEWS`) — width is correct; this redesign only changes how ships are sized/placed/hazed.
- **Bearing is the anchor** — never alter the horizontal placement derived from `s._enu`/true bearing.
- **Out of scope (separate specs):** the look-toward zoom (step 2 of the agreed plan) and the Full sweep / cylindrical projection black-screen fix.
- `MIN_SHIP_PX` / `SIZE_CAP_FRAC` / `apparentWidthPx` remain in place (used only by `geometry.test.js`); the perceptual model uses angular sizes instead.
```
