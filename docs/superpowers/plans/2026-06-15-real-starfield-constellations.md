# Real Starfield + Constellations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake "grid" Fibonacci starfield with the real magnitude-6 sky (vendored catalog) placed at true alt/az for Blue Bay, with brightness/colour variation, constellation lines (toggleable), and rotation through the night.

**Architecture:** A pure `stars.js` does the astronomy (sidereal time, RA/Dec→alt/az, B–V colour, magnitude→size) — unit-tested under node. A browser `star-field.js` loads the vendored `public/data/*.json`, builds a `Points` cloud (per-star size+colour via a small ShaderMaterial) and constellation `LineSegments`, recomputes positions from the clock (throttled), and exposes night-alpha + lines-visibility. `world.js` swaps its Fibonacci block for this; a `Lines` toolbar toggle (+ key `l`) drives it.

**Tech Stack:** Vanilla JS ES modules, Three.js r160 (vendored, bare `three`), `node --test`. Data already vendored in `public/data/` (`stars.6.json`, `constellations.lines.json`).

**Key conventions:**
- Azimuth must match the sun's convention so the ENU mapping in `world.js` lines up: `sunPosition` returns compass az `(atan2(...) /rad + 180) mod 360`; `raDecToAltAz` returns the same. ENU/THREE dir = `(cos alt·sin az, sin alt, −cos alt·cos az)·R`.
- Sidereal basis copied from `sky.js`: `d = date.valueOf()/86400000 − 0.5 + 2440588 − 2451545`; `LST_deg = (280.16 + 360.9856235·d + lonDeg) mod 360`.
- Catalog coords are `[RA,Dec]` in degrees with RA wrapped to −180..180 → add 360 if negative. `bv` is a string → `parseFloat`.
- `stars.js` is pure (node-tested). `star-field.js`/`world.js` import `three` (browser-only) → verify with `node --check` + the user's visual check.

---

### Task 1: `stars.js` — astronomy math + tests

**Files:**
- Create: `public/js/stars.js`
- Test: `public/js/stars.test.js`

- [ ] **Step 1: Write the failing tests**

Create `public/js/stars.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { siderealTimeDeg, raDecToAltAz, bvToColor, magToSize } from './stars.js'

test('siderealTimeDeg is in [0,360), advances with time and with longitude', () => {
  const t0 = new Date(Date.UTC(2026, 5, 15, 0, 0, 0))
  const a = siderealTimeDeg(t0, 0)
  assert.ok(a >= 0 && a < 360)
  const later = siderealTimeDeg(new Date(t0.valueOf() + 3600e3), 0)   // +1h ≈ +15.04°
  assert.ok(Math.abs(((later - a + 360) % 360) - 15.041) < 0.1)
  const east = siderealTimeDeg(t0, 10)
  assert.ok(Math.abs(((east - a + 360) % 360) - 10) < 1e-6)           // +10° lon → +10° LST
})

test('raDecToAltAz: a star on the meridian north of zenith sits due north', () => {
  // H=0 (ra==lst), dec(40) > lat(12): altitude 90-|lat-dec|, azimuth due north (0).
  const r = raDecToAltAz(100, 40, 12, 100)
  assert.ok(Math.abs(r.altDeg - (90 - Math.abs(12 - 40))) < 1e-6)     // 62°
  assert.ok(Math.abs(r.azDeg - 0) < 1e-6 || Math.abs(r.azDeg - 360) < 1e-6)
})

test('raDecToAltAz: a star on the meridian south of zenith sits due south', () => {
  const r = raDecToAltAz(100, -10, 12, 100)                            // dec < lat → south
  assert.ok(Math.abs(r.altDeg - (90 - Math.abs(12 - (-10)))) < 1e-6)   // 68°
  assert.ok(Math.abs(r.azDeg - 180) < 1e-6)
})

test('raDecToAltAz: a star can be below the horizon (negative altitude)', () => {
  const r = raDecToAltAz(280, -80, 12, 100)                            // far south, opposite meridian
  assert.ok(r.altDeg < 0)
})

test('bvToColor: blue for low B–V, red for high, clamped', () => {
  const blue = bvToColor(-0.3), red = bvToColor(1.6)
  assert.ok(blue[2] > blue[0])          // blue channel dominates
  assert.ok(red[0] > red[2])            // red channel dominates
  const clamped = bvToColor(99)
  assert.ok(clamped[0] >= clamped[2])   // clamps to the warm end, no NaN
  assert.ok(clamped.every(Number.isFinite))
})

test('magToSize: brighter (lower mag) is larger, floored and capped', () => {
  assert.ok(magToSize(-1.5, 6, 1) > magToSize(3, 6, 1))
  assert.ok(magToSize(3, 6, 1) > magToSize(6, 6, 1))
  assert.ok(magToSize(20, 6, 1) >= 1)        // floor
  assert.ok(magToSize(-20, 6, 1) <= 6)       // cap
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `./stars.js`.

- [ ] **Step 3: Implement `stars.js`**

Create `public/js/stars.js`:

```js
// Astronomy for the real starfield. Pure (no DOM/three) so it unit-tests under node.
// Conventions match sky.js so stars share the sun's azimuth/ENU mapping.
const rad = Math.PI / 180

// Local sidereal time (deg, 0..360) for a date + east-positive longitude (deg).
export function siderealTimeDeg(date, lonDeg) {
  const d = date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545
  return ((280.16 + 360.9856235 * d + lonDeg) % 360 + 360) % 360
}

// Equatorial (RA/Dec deg) → horizon (alt/az deg) for observer latitude + local
// sidereal time. azDeg is a compass bearing (0=N, 90=E), matching sunPosition().
export function raDecToAltAz(raDeg, decDeg, latDeg, lstDeg) {
  const H = (lstDeg - raDeg) * rad, phi = latDeg * rad, dec = decDeg * rad
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  return { altDeg: alt / rad, azDeg: (az / rad + 180 + 360) % 360 }
}

// B–V colour index → approximate star RGB (0..1) via anchor interpolation:
// blue-white (low) → white → yellow → orange-red (high).
const BV_ANCHORS = [
  [-0.4, [0.61, 0.70, 1.00]], [0.0, [0.79, 0.86, 1.00]], [0.4, [1.00, 0.97, 0.95]],
  [0.8, [1.00, 0.91, 0.78]], [1.2, [1.00, 0.82, 0.63]], [1.6, [1.00, 0.74, 0.52]],
  [2.0, [1.00, 0.66, 0.44]]
]
export function bvToColor(bv) {
  const t = Math.max(-0.4, Math.min(2.0, Number.isFinite(bv) ? bv : 0.6))
  for (let i = 1; i < BV_ANCHORS.length; i++) {
    const [t1, c1] = BV_ANCHORS[i]
    if (t <= t1) {
      const [t0, c0] = BV_ANCHORS[i - 1], f = (t - t0) / (t1 - t0)
      return [0, 1, 2].map(k => c0[k] + (c1[k] - c0[k]) * f)
    }
  }
  return BV_ANCHORS[BV_ANCHORS.length - 1][1].slice()
}

// Apparent magnitude → point size (px). Brighter (lower mag) → larger, clamped.
export function magToSize(mag, maxPx = 6, floorPx = 1) {
  const t = (6.5 - mag) / 8                          // -1.5 → ~1, 6.5 → 0
  return Math.max(floorPx, Math.min(maxPx, floorPx + (maxPx - floorPx) * t))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all new star-math tests green).

- [ ] **Step 5: Commit**

```bash
git add public/js/stars.js public/js/stars.test.js
git commit -m "feat(stars): astronomy math — sidereal time, RA/Dec→alt/az, B-V colour, mag→size"
```

---

### Task 2: `star-field.js` — loader, render objects, rotation

**Files:**
- Create: `public/js/star-field.js`

Browser-only (imports `three`). Verify with `node --check`.

- [ ] **Step 1: Create `star-field.js`**

Create `public/js/star-field.js`:

```js
import * as THREE from 'three'
import { siderealTimeDeg, raDecToAltAz, bvToColor, magToSize } from './stars.js'
import { VIEWS, DEFAULT_VIEW } from './config.js'

const R = 50000                                   // star-sphere radius (matches scene scale)
const LAT = VIEWS[DEFAULT_VIEW].lat, LON = VIEWS[DEFAULT_VIEW].lon

// Build the night sky: a Points cloud (per-star size+colour) + constellation
// LineSegments, both recomputed from the clock so the sky wheels overhead. Loads the
// vendored catalog; on failure falls back to a random faint field (never a grid).
export function createStarField(scene) {
  let stars = null, lines = null, starData = [], lineData = [], lastMs = -1

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vColor;
      void main(){ vColor = aColor; gl_PointSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision mediump float; uniform float uAlpha; varying vec3 vColor;
      void main(){ float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vColor, a * uAlpha); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  })
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x6f86b0, transparent: true, opacity: 0, depthWrite: false, fog: false
  })

  function buildObjects() {
    if (stars) { scene.remove(stars); stars.geometry.dispose() }
    const n = starData.length
    const pos = new Float32Array(n * 3), aSize = new Float32Array(n), aColor = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      aSize[i] = starData[i].size
      const c = starData[i].color; aColor[i * 3] = c[0]; aColor[i * 3 + 1] = c[1]; aColor[i * 3 + 2] = c[2]
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3))
    stars = new THREE.Points(g, starMat); stars.frustumCulled = false; scene.add(stars)

    if (lines) { scene.remove(lines); lines.geometry.dispose() }
    let vcount = 0; for (const pl of lineData) vcount += Math.max(0, pl.length - 1) * 2
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, vcount) * 3), 3))
    lines = new THREE.LineSegments(lg, lineMat); lines.frustumCulled = false; scene.add(lines)
    lastMs = -1                                   // force a recompute on next update
  }

  function recompute(date) {
    if (!stars) return
    const lst = siderealTimeDeg(date, LON)
    const pos = stars.geometry.attributes.position.array, size = stars.geometry.attributes.aSize.array
    for (let i = 0; i < starData.length; i++) {
      const s = starData[i], { altDeg, azDeg } = raDecToAltAz(s.ra, s.dec, LAT, lst)
      size[i] = altDeg < 0 ? 0 : s.size            // hide below-horizon stars
      const al = altDeg * Math.PI / 180, az = azDeg * Math.PI / 180, ca = Math.cos(al)
      pos[i * 3] = R * ca * Math.sin(az); pos[i * 3 + 1] = R * Math.sin(al); pos[i * 3 + 2] = -R * ca * Math.cos(az)
    }
    stars.geometry.attributes.position.needsUpdate = true
    stars.geometry.attributes.aSize.needsUpdate = true

    const lp = lines.geometry.attributes.position.array; let k = 0
    for (const pl of lineData) {
      for (let j = 0; j < pl.length - 1; j++) {
        for (const p of [pl[j], pl[j + 1]]) {
          const { altDeg, azDeg } = raDecToAltAz(p[0], p[1], LAT, lst)
          const al = altDeg * Math.PI / 180, az = azDeg * Math.PI / 180, ca = Math.cos(al)
          lp[k++] = R * ca * Math.sin(az); lp[k++] = R * Math.sin(al); lp[k++] = -R * ca * Math.cos(az)
        }
      }
    }
    lines.geometry.attributes.position.needsUpdate = true
  }

  function buildFromCatalog(starsJson, linesJson) {
    starData = starsJson.features.map(f => {
      const c = f.geometry.coordinates
      return { ra: c[0] < 0 ? c[0] + 360 : c[0], dec: c[1],
        size: magToSize(f.properties.mag, 6), color: bvToColor(parseFloat(f.properties.bv)) }
    })
    lineData = []
    for (const f of linesJson.features) for (const seg of f.geometry.coordinates)
      lineData.push(seg.map(p => [p[0] < 0 ? p[0] + 360 : p[0], p[1]]))
    buildObjects()
  }

  function buildFallback() {
    starData = []
    for (let i = 0; i < 1500; i++) {
      starData.push({ ra: Math.random() * 360, dec: Math.asin(2 * Math.random() - 1) / Math.PI * 180,
        size: 1 + Math.random() * Math.random() * 3.5, color: [1, 1, 0.96] })
    }
    lineData = []
    buildObjects()
  }

  Promise.all([
    fetch('data/stars.6.json').then(r => { if (!r.ok) throw new Error('stars ' + r.status); return r.json() }),
    fetch('data/constellations.lines.json').then(r => { if (!r.ok) throw new Error('lines ' + r.status); return r.json() })
  ]).then(([s, l]) => buildFromCatalog(s, l))
    .catch(e => { console.warn('[stars] catalog load failed; random fallback:', e.message); buildFallback() })

  return {
    update(date) {
      if (!stars) return
      const ms = date.valueOf()
      if (lastMs > 0 && ms - lastMs < 12000) return    // sky moves ~0.25°/min — recompute every ~12s
      lastMs = ms
      recompute(date)
    },
    setNightAlpha(a) { starMat.uniforms.uAlpha.value = a; lineMat.opacity = a * 0.45 },
    setLinesVisible(b) { if (lines) lines.visible = b }
  }
}
```

- [ ] **Step 2: Validate syntax**

Run: `node --check public/js/star-field.js`
Expected: no output (OK).

- [ ] **Step 3: Commit**

```bash
git add public/js/star-field.js
git commit -m "feat(stars): star-field — load catalog, per-star Points + constellation lines, rotate"
```

---

### Task 3: Wire the star field into `world.js`

**Files:**
- Modify: `public/js/world.js`

- [ ] **Step 1: Import `createStarField`**

In `public/js/world.js`, after the existing `import { makeShipMesh, ... } from './ship-meshes.js'` line, add:

```js
import { createStarField } from './star-field.js'
```

- [ ] **Step 2: Replace the Fibonacci star block**

Replace this entire block:

```js
  // Fixed starfield, evenly scattered over a full sphere (Fibonacci sphere) so the
  // visible upper sky reads as a natural starfield — no Math.abs equator pile-up that
  // bunched stars into an arc on the horizon. Opacity driven by env.starAlpha.
  const starGeo = new THREE.BufferGeometry()
  const starN = 2600, R = 50000, starPos = new Float32Array(starN * 3)
  for (let i = 0; i < starN; i++) {
    const y = 1 - ((i + 0.5) / starN) * 2          // +1 (zenith) → -1 (nadir), even
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const th = i * 2.399963229                      // golden angle (rad)
    starPos[i * 3] = R * rad * Math.cos(th)
    starPos[i * 3 + 1] = R * y                      // below-horizon stars simply aren't seen
    starPos[i * 3 + 2] = R * rad * Math.sin(th)
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xfffff5, size: 70, sizeAttenuation: true, transparent: true, opacity: 0, fog: false
  }))
  scene.add(stars)
```

with:

```js
  // Real magnitude-6 sky placed at true alt/az for the deck, wheeling with the clock,
  // with constellation lines. Replaces the old even Fibonacci field (which read as a grid).
  const starField = createStarField(scene)
```

- [ ] **Step 3: Drive the star field from `updateEnv`**

In `public/js/world.js`, find this line in `updateEnv`:

```js
    stars.material.opacity = night
```

Replace it with:

```js
    starField.setNightAlpha(night)
    if (env.date) starField.update(env.date)
```

- [ ] **Step 4: Expose the lines toggle on the world object**

In `public/js/world.js`, find the final return of `createWorld`:

```js
  return { renderer, scene, water, setProjection, getProjection: () => projection, updateEnv, resize, render, updateShips, shipScreenRects }
```

Replace it with:

```js
  return { renderer, scene, water, setProjection, getProjection: () => projection, updateEnv, resize, render, updateShips, shipScreenRects,
    setConstellationLines: b => starField.setLinesVisible(b) }
```

- [ ] **Step 5: Validate**

Run: `node --check public/js/world.js`
Expected: no output.
Run: `grep -n "const stars\b\|stars.material\|starGeo" public/js/world.js`
Expected: no matches (old field fully removed).
Run: `npm test`
Expected: PASS (no test imports world.js).

- [ ] **Step 6: Commit**

```bash
git add public/js/world.js
git commit -m "feat(world): use real star field (catalog + constellations) instead of Fibonacci grid"
```

---

### Task 4: Feed the date + wire the Lines toggle

**Files:**
- Modify: `public/js/main.js`
- Modify: `public/js/ui.js`
- Modify: `public/index.html`

- [ ] **Step 1: Pass the date into `updateEnv`**

In `public/js/main.js`, find:

```js
  world.updateEnv({ sunAz: sp.azimuth, sunEl: sp.elevation, sightlineKm: effSl,
    starAlpha: env.starAlpha, windKn: wx?.windKn })
```

Replace with:

```js
  world.updateEnv({ sunAz: sp.azimuth, sunEl: sp.elevation, sightlineKm: effSl,
    starAlpha: env.starAlpha, windKn: wx?.windKn, date: now })
```

- [ ] **Step 2: Add a generic action-toggle helper to `ui.js`**

In `public/js/ui.js`, immediately AFTER the `initPanelToggles` function's closing `}`, add:

```js
// A toolbar button + key that toggles a boolean and calls onToggle(state). Initial
// state from the button's data-on attr. Used for scene toggles (e.g. constellation lines).
export function initActionToggle(btnId, key, onToggle) {
  const btn = document.getElementById(btnId)
  if (!btn) return
  let on = btn.dataset.on === 'true'
  const apply = () => { btn.classList.toggle('on', on); onToggle(on) }
  const toggle = () => { on = !on; apply() }
  btn.addEventListener('click', toggle)
  window.addEventListener('keydown', e => {
    if (e.target.matches && e.target.matches('input, textarea, button')) return
    if (e.key.toLowerCase() === key) toggle()
  })
  apply()
}
```

- [ ] **Step 3: Import and wire it in `main.js`**

In `public/js/main.js`, add `initActionToggle` to the `./ui.js` import (append it to the existing destructured list):

```js
import { renderWeather, renderVerdict, initControls, showTooltip, trackSticky, setShipsStatus, initViewToggle, initPanelToggles, initActionToggle } from './ui.js'
```

Then, right after the existing `initPanelToggles()` call, add:

```js
initActionToggle('t-lines', 'l', on => world.setConstellationLines(on))
```

- [ ] **Step 4: Add the Lines button to the toolbar**

In `public/index.html`, in the `#toggles` div, after the Calibration button, add:

```html
    <button id="t-lines" data-on="true">Lines</button>
```

- [ ] **Step 5: Validate**

Run: `node --check public/js/main.js && node --check public/js/ui.js`
Expected: both OK.
Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/js/main.js public/js/ui.js public/index.html
git commit -m "feat(ui): feed clock to star field; Lines toggle (button + 'l' key)"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Whole suite + syntax**

Run: `npm test`
Expected: PASS, 0 failures (≈ 94 tests: prior 88 + 6 star-math).
Run: `node --check public/js/star-field.js && node --check public/js/world.js && node --check public/js/main.js && node --check public/js/ui.js`
Expected: all OK.

- [ ] **Step 2: Confirm the old field is gone**

Run: `grep -rn "Fibonacci\|2.399963229\|starGeo" public/js`
Expected: no matches.

- [ ] **Step 3: Visual check (user, host-side, at night)**

`git pull`, refresh, and (if it's daytime in-app) temporarily check after dusk or note stars only show at night. Confirm:
- The sky reads as a **real, random, varied** field — not a grid — with a few bright stars and many faint, subtle colour differences.
- Recognizable constellations sit in **true positions** for 12°N (e.g. Orion, Scorpius, the Southern Cross low to the south).
- The **`Lines`** button (and key `l`) shows/hides constellation lines.
- Stars fade in at dusk and **wheel slowly** through the night.
- If the catalog ever fails to load, a random fallback field still appears (no grid) — check the console for `[stars] catalog load failed` only if stars are missing.

- [ ] **Step 4: Update project memory**

After the user confirms, update the BB45 project memory: real starfield + constellations BUILT (catalog vendored in `public/data/`, `stars.js`/`star-field.js`, Lines toggle, rotates with clock); note remaining threads (3D ship models, haze punch-up, baking tuned calibration values).

---

## Notes for the implementer

- **Don't change** the data files in `public/data/` — they're vendored and correct.
- The star ShaderMaterial uses custom attributes `aSize`/`aColor` (NOT `color`, which collides with Three's built-in vertex-colour handling).
- Rotation is throttled to ~12 s; the sky moves ~0.25°/min so this is imperceptible and cheap.
- Lines default **on** (faint); toggle off for a pure naked-eye sky. Change the `data-on` attr to flip the default.
- Out of scope (separate threads): 3D ship models, the haze punch-up, baking the tuned Size/Spread/Haze values.
```
