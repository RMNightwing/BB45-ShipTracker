# 3D Ship Meshes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat billboard ship sprites with procedural low-poly 3D meshes that orient to their heading, sit in the water with a wake and reflection, and fan out across the foreground via the spec's `EXAGGERATION` vertical nudge.

**Architecture:** Ships become procedural `THREE.Group` meshes built in true metres (new `ship-meshes.js`, proportions in pure `ship-dims.js`). A pure `fannedPlacement` helper in `geometry.js` pulls near ships closer along their sight-ray and scales them down so bearing + apparent size stay exact while they drop lower in the frame. `world.js` rewires `updateShips` to position/rotate/scale the meshes, drive hull-down via a per-ship clipping plane, add a wake, and lift a night emissive. The 2D silhouette pipeline (`ship-sprites.js`, the `SILHOUETTES`/palette/LOD exports in `ships.js`) is retired; scene lighting now does day/night.

**Tech Stack:** Vanilla JS ES modules, Three.js r160 (vendored, bare specifier `three` via importmap), `node --test` for pure modules. No new dependencies.

**Key conventions:**
- Mesh local frame: **X = beam (starboard +), Y = up (waterline at y=0), Z = length (bow toward −Z, stern +Z).** With this frame, `mesh.rotation.y = -toRad(course)` aims the bow at the compass course.
- `three`-importing modules (`world.js`, `projections.js`, `ship-meshes.js`) are NOT node-testable (no WebGL/importmap under node) — verify them visually. Pure modules (`geometry.js`, `ship-dims.js`) get `node --test` coverage.
- `npm test` runs `node --test` over `*.test.js`. The user verifies visuals with host-side `npm start` (sandbox localhost is unreachable).

---

### Task 1: Config constants for the fan-out nudge

**Files:**
- Modify: `public/js/config.js`

- [ ] **Step 1: Add `EXAGGERATION` and `NEAR_KM`**

In `public/js/config.js`, add after the `FAR_KM` block (around line 28):

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

- [ ] **Step 2: Commit**

```bash
git add public/js/config.js
git commit -m "feat(config): add EXAGGERATION + NEAR_KM for ship fan-out"
```

---

### Task 2: `fannedPlacement` pure helper + tests

**Files:**
- Modify: `public/js/geometry.js` (add after `nearness`, around line 64)
- Test: `public/js/geometry.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `public/js/geometry.test.js`:

```js
import { fannedPlacement } from './geometry.js'

test('fannedPlacement leaves a far-edge ship unchanged (nearness 0 → scale 1)', () => {
  const eye = { e: 0, n: 0 }, ship = { e: 0, n: 10000 } // 10 km north
  const r = fannedPlacement(eye, ship, 40, 0.7, 2, 40)  // distance == farKm → nearness 0
  assert.equal(r.scale, 1)
  assert.equal(r.e, 0)
  assert.equal(r.n, 10000)
})

test('fannedPlacement preserves bearing (result is colinear with eye→ship)', () => {
  const eye = { e: 0, n: 0 }, ship = { e: 3000, n: 4000 } // 5 km, bearing ~36.9°
  const r = fannedPlacement(eye, ship, 5, 0.7, 2, 40)
  // colinear ⇒ cross product of (ship) and (result) is ~0
  assert.ok(Math.abs(r.e * ship.n - r.n * ship.e) < 1e-6)
  assert.ok(r.scale < 1) // a near ship is pulled in
})

test('fannedPlacement preserves apparent size (scale / resultDistance == 1 / trueDistance)', () => {
  const eye = { e: 0, n: 0 }, ship = { e: 0, n: 5000 } // 5 km == 5000 m
  const r = fannedPlacement(eye, ship, 5, 0.7, 2, 40)
  const resultDist = Math.hypot(r.e - eye.e, r.n - eye.n)
  assert.ok(Math.abs(r.scale / resultDist - 1 / 5000) < 1e-9)
})

test('fannedPlacement nudges nearer ships more (smaller scale)', () => {
  const eye = { e: 0, n: 0 }, ship = { e: 0, n: 5000 }
  const near = fannedPlacement(eye, ship, 3, 0.7, 2, 40)
  const far = fannedPlacement(eye, ship, 20, 0.7, 2, 40)
  assert.ok(near.scale < far.scale)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `fannedPlacement` is not exported / not a function.

- [ ] **Step 3: Implement `fannedPlacement`**

In `public/js/geometry.js`, add directly after the `nearness` function (after line 64):

```js
// Fan-out placement: pull a near ship closer along its own sight-ray from the eye so
// it sits lower in the frame, scaling it down by the same factor so its bearing and
// apparent (angular) size stay exact. Far ships (nearness 0) are unchanged — and
// hull-down, computed from the TRUE distance, stays physically exact. eye/ship are
// ground points {e,n} in the same ENU frame. Returns {e,n,scale}.
export function fannedPlacement(eye, ship, distanceKm, exaggeration, nearKm, farKm) {
  const f = 1 - exaggeration * nearness(distanceKm, nearKm, farKm)
  return {
    e: eye.e + f * (ship.e - eye.e),
    n: eye.n + f * (ship.n - eye.n),
    scale: f
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all four new tests green, existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add public/js/geometry.js public/js/geometry.test.js
git commit -m "feat(geometry): fannedPlacement — bearing/size-exact vertical fan-out"
```

---

### Task 3: `ship-dims.js` pure proportions + tests

**Files:**
- Create: `public/js/ship-dims.js`
- Test: `public/js/ship-dims.test.js`

- [ ] **Step 1: Write the failing tests**

Create `public/js/ship-dims.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shipDims, SHIP_DIMS } from './ship-dims.js'

test('shipDims returns length unchanged and beam/hullH scaled by the type ratio', () => {
  const d = shipDims('container', 300)
  assert.equal(d.length, 300)
  assert.ok(Math.abs(d.beam - 300 * SHIP_DIMS.container.beam) < 1e-9)
  assert.ok(Math.abs(d.hullH - 300 * SHIP_DIMS.container.hullH) < 1e-9)
})

test('shipDims falls back to the default bucket for an unknown type', () => {
  const d = shipDims('submarine', 100)
  assert.ok(Math.abs(d.beam - 100 * SHIP_DIMS.default.beam) < 1e-9)
})

test('every known type has positive beam and hull ratios', () => {
  for (const k of Object.keys(SHIP_DIMS)) {
    assert.ok(SHIP_DIMS[k].beam > 0 && SHIP_DIMS[k].hullH > 0, k)
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `./ship-dims.js`.

- [ ] **Step 3: Implement `ship-dims.js`**

Create `public/js/ship-dims.js`:

```js
// Per-type proportions for the low-poly ship meshes. Pure data + math, NO three
// import, so it unit-tests under node. Ratios are fractions of overall length L (m).
export const SHIP_DIMS = {
  container: { beam: 0.14, hullH: 0.090 },
  tanker:    { beam: 0.16, hullH: 0.075 },
  bulk:      { beam: 0.15, hullH: 0.090 },
  cruise:    { beam: 0.13, hullH: 0.060 },
  coaster:   { beam: 0.17, hullH: 0.140 },
  yacht:     { beam: 0.22, hullH: 0.110 },
  default:   { beam: 0.15, hullH: 0.100 }
}

// Resolve a type + length (m) to concrete metre dimensions for the mesh builder.
export function shipDims(type, lenM) {
  const r = SHIP_DIMS[type] || SHIP_DIMS.default
  return { length: lenM, beam: lenM * r.beam, hullH: lenM * r.hullH }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/js/ship-dims.js public/js/ship-dims.test.js
git commit -m "feat(ships): ship-dims pure per-type proportions"
```

---

### Task 4: `ship-meshes.js` — procedural low-poly builders

**Files:**
- Create: `public/js/ship-meshes.js`

No node test (imports `three`). Verified visually in Task 7.

- [ ] **Step 1: Create `ship-meshes.js`**

Create `public/js/ship-meshes.js`:

```js
import * as THREE from 'three'
import { shipDims } from './ship-dims.js'

// Ships are lit by the scene's sun + ambient, so day/night dimming is automatic; a
// small per-frame emissive (set in world.js) keeps them off pure-black at deep night.
// Local frame: X = beam (starboard +), Y = up (waterline y=0), Z = length (bow −Z).
const C = {
  hull: 0x2a4a57, deck: 0x35525e, white: 0xd8e2e6, dark: 0x223038,
  rust: 0x8a4b39, funnel: 0x3f4a52, slate: 0x56707c,
  boxes: [0x7c4a3a, 0x3f6e72, 0x9c8350, 0x56707c, 0x6b4a52, 0x3f5a6e]
}

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.08, fog: true })
}

// A box (w along X, h along Y, l along Z) centred at (x,y,z).
function box(w, h, l, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), material)
  m.position.set(x, y, z)
  return m
}

// Shared low hull: a main box (y 0..hullH) plus a shorter, narrower forward box for a
// hint of a bow. Length L along Z, beam B along X.
function hull(L, B, hullH, color) {
  const g = new THREE.Group()
  g.add(box(B, hullH, L * 0.92, 0, hullH / 2, L * 0.04, mat(color)))
  g.add(box(B * 0.7, hullH * 0.9, L * 0.12, 0, hullH * 0.5, -L * 0.46, mat(color)))
  return g
}

const BUILDERS = {
  container(L, B, hullH) {
    const g = hull(L, B, hullH, C.hull)
    const rows = 7, cols = 3
    const cellL = (L * 0.66) / rows, cellW = (B * 0.8) / cols, cellH = hullH * 0.9
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tiers = 3 - ((r + c) % 2)
        for (let t = 0; t < tiers; t++) {
          g.add(box(cellW * 0.9, cellH * 0.9, cellL * 0.9,
            (c - (cols - 1) / 2) * cellW, hullH + cellH / 2 + t * cellH,
            (-L * 0.26) + r * cellL, mat(C.boxes[(r + c + t) % C.boxes.length])))
        }
      }
    }
    g.add(box(B * 0.8, hullH * 1.6, L * 0.08, 0, hullH + hullH * 0.8, L * 0.40, mat(C.white)))
    g.add(box(B * 0.25, hullH * 1.1, L * 0.05, 0, hullH + hullH * 2.15, L * 0.42, mat(C.funnel)))
    return g
  },
  tanker(L, B, hullH) {
    const g = hull(L, B, hullH, C.hull)
    g.add(box(B * 0.5, hullH * 0.5, L * 0.5, 0, hullH + hullH * 0.25, -L * 0.02, mat(C.slate)))
    g.add(box(B * 0.85, hullH * 2.2, L * 0.10, 0, hullH + hullH * 1.1, L * 0.40, mat(C.white)))
    g.add(box(B * 0.25, hullH * 1.2, L * 0.05, 0, hullH + hullH * 2.8, L * 0.42, mat(C.funnel)))
    return g
  },
  bulk(L, B, hullH) {
    const g = hull(L, B, hullH, C.hull)
    const hatches = 5
    for (let i = 0; i < hatches; i++) {
      g.add(box(B * 0.7, hullH * 0.3, L * 0.1, 0, hullH + hullH * 0.15,
        (-L * 0.3) + i * (L * 0.6 / (hatches - 1)), mat(C.deck)))
    }
    for (const z of [-L * 0.15, L * 0.10]) {
      g.add(box(B * 0.06, hullH * 2.0, B * 0.06, 0, hullH + hullH, z, mat(C.slate)))
    }
    g.add(box(B * 0.85, hullH * 1.6, L * 0.08, 0, hullH + hullH * 0.8, L * 0.40, mat(C.white)))
    return g
  },
  cruise(L, B, hullH) {
    const g = hull(L, B, hullH, C.dark)
    g.add(box(B * 0.92, hullH * 0.35, L * 0.80, 0, hullH + hullH * 0.4, 0, mat(C.dark)))
    const tiers = 4
    for (let t = 0; t < tiers; t++) {
      const s = 1 - t * 0.12
      g.add(box(B * 0.9 * s, hullH * 1.2, L * 0.78 * s, 0, hullH + hullH * 0.6 + t * hullH * 1.2, 0, mat(C.white)))
    }
    g.add(box(B * 0.3, hullH * 1.4, L * 0.06, 0, hullH + hullH * 0.6 + tiers * hullH * 1.2, L * 0.15, mat(C.funnel)))
    return g
  },
  coaster(L, B, hullH) {
    const g = hull(L, B, hullH, C.rust)
    g.add(box(B * 0.7, hullH * 0.5, L * 0.45, 0, hullH + hullH * 0.25, -L * 0.05, mat(C.deck)))
    g.add(box(B * 0.8, hullH * 1.3, L * 0.14, 0, hullH + hullH * 0.65, L * 0.36, mat(C.white)))
    return g
  },
  yacht(L, B, hullH) {
    const g = hull(L, B, hullH, C.white)
    g.add(box(B * 0.6, hullH * 0.7, L * 0.40, 0, hullH + hullH * 0.35, -L * 0.05, mat(C.white)))
    g.add(box(B * 0.4, hullH * 0.4, L * 0.18, 0, hullH + hullH * 0.9, 0, mat(C.slate)))
    return g
  }
}

// Build a low-poly ship mesh group for {type, len}. Built in true metres in the local
// frame above. Each call makes its own materials, so per-ship clip planes / emissive
// can be set without affecting other ships.
export function makeShipMesh(ship) {
  const d = shipDims(ship.type, ship.len || 80)
  const build = BUILDERS[ship.type] || BUILDERS.coaster
  const g = build(d.length, d.beam, d.hullH)
  const b = new THREE.Box3().setFromObject(g)
  g.userData.heightM = b.max.y - b.min.y
  return g
}

// Every material in a ship group (so world.js can set emissive / clip planes). Call
// BEFORE adding the wake so the wake material is excluded.
export function shipMaterials(group) {
  const out = []
  group.traverse(o => { if (o.material) out.push(o.material) })
  return out
}
```

- [ ] **Step 2: Sanity-check it parses (node import smoke test)**

Run: `node -e "import('three').catch(()=>{}); console.log('skip — three is browser-only')"`
Expected: prints the skip line (we do NOT node-import `ship-meshes.js`; it resolves `three` only in the browser). Real verification is visual in Task 7.

- [ ] **Step 3: Commit**

```bash
git add public/js/ship-meshes.js
git commit -m "feat(ships): procedural low-poly 3D ship mesh builders"
```

---

### Task 5: Wake builder in `ship-meshes.js`

**Files:**
- Modify: `public/js/ship-meshes.js`

- [ ] **Step 1: Add the wake builder**

Append to `public/js/ship-meshes.js`:

```js
// A translucent foam wake laid flat on the water behind the ship, extending astern
// (+Z), length/alpha scaled by knots. Added as a child of the ship group so it
// inherits the heading + fan-out scale and stays grounded (local y≈0). Its own
// material (no clip plane) so it isn't hull-down-clipped.
export function makeWake(lenM, knots) {
  const wakeLen = lenM * (1 + (knots || 0) * 0.5)
  const geo = new THREE.PlaneGeometry(lenM * 0.5, wakeLen)
  geo.rotateX(-Math.PI / 2)                          // lie flat on the XZ water plane
  geo.translate(0, 0.4, wakeLen / 2 + lenM * 0.45)   // start just astern of the stern
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: wakeTexture(), color: 0xffffff, transparent: true,
    opacity: Math.min(0.5, 0.12 + (knots || 0) * 0.03), fog: true, depthWrite: false
  }))
  return m
}

function wakeTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 64, 0, 0)    // bright at the stern → fade aft
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 64)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/ship-meshes.js
git commit -m "feat(ships): speed-scaled foam wake for ship meshes"
```

---

### Task 6: Expose `eyeGround()` on the projections

**Files:**
- Modify: `public/js/projections.js`

`world.js` needs the camera's ground point (in the ENU frame ships use) to fan ships toward it.

- [ ] **Step 1: Add `eyeGround()` to `PerspectiveProjection`**

In `public/js/projections.js`, inside `class PerspectiveProjection`, add after the `render` method:

```js
  // Ground point {e,n} of the eye in the world ENU frame (x=e, z=-n).
  eyeGround() { return { e: this.camera.position.x, n: -this.camera.position.z } }
```

- [ ] **Step 2: Add `eyeGround()` to `CylindricalProjection`**

In `public/js/projections.js`, inside `class CylindricalProjection`, add after the `render` method:

```js
  eyeGround() { return { e: this.eye.x, n: -this.eye.z } }
```

- [ ] **Step 3: Commit**

```bash
git add public/js/projections.js
git commit -m "feat(projections): expose eyeGround() for ship fan-out"
```

---

### Task 7: Rewire `world.js` to render 3D ship meshes

**Files:**
- Modify: `public/js/world.js`

- [ ] **Step 1: Swap imports**

In `public/js/world.js`, replace the sprite import (line 6):

```js
import { makeShipSprite, shipTexture } from './ship-sprites.js'
```

with:

```js
import { makeShipMesh, makeWake, shipMaterials } from './ship-meshes.js'
```

And replace the geometry import (line 4):

```js
import { enu, toRad, hullDownState } from './geometry.js'
```

with:

```js
import { enu, toRad, hullDownState, fannedPlacement } from './geometry.js'
```

And replace the config import (line 5):

```js
import { VIEWS, DEFAULT_VIEW, SUPERSTRUCTURE_M } from './config.js'
```

with:

```js
import { VIEWS, DEFAULT_VIEW, SUPERSTRUCTURE_M, EXAGGERATION, NEAR_KM, FAR_KM } from './config.js'
```

- [ ] **Step 2: Enable local clipping**

In `public/js/world.js`, right after `const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })`, add:

```js
  renderer.localClippingEnabled = true   // per-ship hull-down clip planes
```

- [ ] **Step 3: Replace the ship layer + `updateShips` + `shipScreenRects`**

In `public/js/world.js`, replace this whole block — from `const shipLayer = new THREE.Group(); scene.add(shipLayer)` down through the end of the `shipScreenRects` function — with:

```js
  const shipLayer = new THREE.Group(); scene.add(shipLayer)
  const meshes = new Map()
  // Caller sets s._distanceKm and s._enu (ENU vs DEFAULT_VIEW origin) on each ship.
  function updateShips(ships, env) {
    const eye = projection ? projection.eyeGround() : { e: 0, n: 0 }
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
        for (const m of sp.userData.materials) m.clippingPlanes = [sp.userData.clip]
        sp.add(makeWake(len, s.kn))
        shipLayer.add(sp); meshes.set(s.id, sp)
      }
      // Fan-out: pull near ships closer along the sight-ray (lower in frame), scaled
      // down so bearing + apparent size stay exact. Hull-down uses the TRUE distance.
      const p = fannedPlacement(eye, { e: s._enu.e, n: s._enu.n }, s._distanceKm, EXAGGERATION, NEAR_KM, FAR_KM)
      sp.position.set(p.e, 0, -p.n)
      sp.rotation.y = -toRad(s.course ?? s.cog ?? 0)
      sp.scale.setScalar(p.scale)
      // Hull-down: raise the world-space clip plane so the lower hull is cut as the
      // ship recedes (keep y ≥ clipFrac × world height).
      const worldH = sp.userData.heightM * p.scale
      sp.userData.clip.constant = -(hd.clipFrac * worldH)
      // Night legibility: lift an emissive floor as ambient falls.
      const emis = Math.max(0, 0.5 - (env.ambient ?? 1) * 0.5)
      for (const m of sp.userData.materials) {
        if (m.emissive) { m.emissive.setHex(0x223038); m.emissiveIntensity = emis }
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
      if (o.geometry) o.geometry.dispose()
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose() }
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
```

(The `return { ... updateShips, shipScreenRects }` line at the end of `createWorld` is unchanged.)

- [ ] **Step 4: Run the test suite**

Run: `npm test`
Expected: PASS — no node test imports `world.js`, so this is a regression check that nothing else broke yet. (Tasks 8–9 fix the remaining `ships.js`/sprite references.)

- [ ] **Step 5: Commit**

```bash
git add public/js/world.js
git commit -m "feat(world): render ships as 3D meshes with fan-out, heading, hull-down clip, wake, night emissive"
```

---

### Task 8: Delete `ship-sprites.js`

**Files:**
- Delete: `public/js/ship-sprites.js`

- [ ] **Step 1: Confirm nothing imports it**

Run: `grep -rn "ship-sprites" public/js`
Expected: no matches (Task 7 removed the only import).

- [ ] **Step 2: Delete the file**

```bash
git rm public/js/ship-sprites.js
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS (imports.test.js confirms no dangling relative import).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(ships): remove obsolete 2D billboard sprite renderer"
```

---

### Task 9: Retire the 2D silhouette exports from `ships.js`

**Files:**
- Modify: `public/js/ships.js`
- Modify: `public/js/ships.test.js`

`SILHOUETTES`, `shipPalette`, `nightLift`, `lodDetail` and their helpers (`SHIP`, `MOON_MID`, `mix`, `hex`, `rim`) were only used by the deleted `ship-sprites.js`. Keep `padRect` and `shipAtPoint`.

- [ ] **Step 1: Remove the dead tests first**

In `public/js/ships.test.js`, change the import line:

```js
import { shipAtPoint, padRect, nightLift, lodDetail } from './ships.js'
```

to:

```js
import { shipAtPoint, padRect } from './ships.js'
```

Then delete the three trailing tests: `'nightLift is 0 in daylight...'`, `'nightLift treats missing ambient...'`, and `'lodDetail is 0 for a tiny ship...'`.

- [ ] **Step 2: Run tests to confirm the remaining ships.test.js is green**

Run: `npm test`
Expected: PASS (hit-testing tests still pass; nightLift/lodDetail tests gone).

- [ ] **Step 3: Strip the dead exports from `ships.js`**

In `public/js/ships.js`, delete everything related to the 2D silhouettes, keeping ONLY `padRect` and `shipAtPoint`. Remove: `nightLift`, the `SHIP` const, `MOON_MID`, `shipPalette`, `rim`, the entire `SILHOUETTES` object, `lodDetail`, and the `mix`/`hex` helpers. After this edit `ships.js` should contain only the `padRect` and `shipAtPoint` functions (and their comments).

- [ ] **Step 4: Confirm no remaining references**

Run: `grep -rn "SILHOUETTES\|shipPalette\|nightLift\|lodDetail" public/js`
Expected: no matches.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/js/ships.js public/js/ships.test.js
git commit -m "chore(ships): retire 2D silhouette/palette/LOD exports (lighting + meshes replace them)"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS, all `*.test.js` green. Note the new count vs the previous 78.

- [ ] **Step 2: Confirm no stale references remain**

Run: `grep -rn "makeShipSprite\|shipTexture\|ship-sprites" public/js`
Expected: no matches.

- [ ] **Step 3: Visual check (user, host-side)**

The user runs `npm start` on their Windows host and confirms in the browser:
- Ships are recognizable 3D objects, oriented to their course (a ship angling toward/away looks foreshortened, not full-broadside).
- The fleet fans across the foreground→horizon: at least one large near ship low in the frame and one faint hull-down ship near the horizon, with clear vertical + size variation. (If too subtle or too extreme, tune `EXAGGERATION` in `config.js`.)
- Ships sit in the water — visible reflection + a speed-scaled wake behind moving ships; no baked drop-shadow.
- Day→night reads naturally; deep-night ships stay legible (emissive floor) and the far edge still fades via haze + hull-down.

- [ ] **Step 4: Update project memory**

After the user confirms the visual, update the BB45 project memory note to mark the 3D ship-meshes redesign BUILT (mirroring how prior milestones are recorded), and that the Full sweep / cylindrical projection fix is the next queued item.

---

## Notes for the implementer

- **Tuning knobs** live in `config.js`: `EXAGGERATION` (fan-out strength), `NEAR_KM` (full-nudge distance). Start at the committed values; expect to adjust `EXAGGERATION` by eye.
- **Do NOT touch the camera calibration** (`VIEWS` in `config.js`) — the fan-out, not the camera, fills the foreground.
- **Full sweep (max) view** is knowingly distorted (the cylindrical projection renders black and falls back to a 156° perspective camera). That's a SEPARATE follow-up spec — out of scope here. Spec: `docs/superpowers/specs/2026-06-14-ship-3d-meshes-design.md` (Related follow-up).
- `SIZE_CAP_FRAC` / `MIN_SHIP_PX` / `apparentWidthPx` are left in place (used only by `geometry.test.js` now); true-metre meshes + perspective make apparent size correct without them.
```
