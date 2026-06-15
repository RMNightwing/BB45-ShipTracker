# glTF Ship Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the four covered ship types from the purchased low-poly GLB (`public/models/lowpoly_cargoship.glb`), keeping the procedural meshes as the fallback, all flowing through the existing perceptual size / heading / wake / haze / hull-down path.

**Architecture:** Vendor `GLTFLoader`; a pure `ship-models-math.js` computes the normalize transform; a browser `ship-models.js` loads the GLB once, extracts the 5 named ship nodes, normalizes the 4 mapped ones into unit templates, and serves per-ship clones (materials cloned, geometry/textures shared) matching `makeShipMesh`'s contract. `world.js` picks model-or-procedural per ship and upgrades procedural→model once the async load finishes.

**Tech Stack:** Vanilla JS ES modules, Three.js r160 (vendored, bare `three`), `node --test`.

**Key conventions:**
- The GLB is a 5-ship `Scene`; each ship modeled **length +X, up +Y, beam +Z**. Mapping (config): `container→boat1, coaster→boat2, bulk→boat4, tanker→boat5`. cruise/yacht/unmapped → procedural fallback.
- Model contract = procedural contract: a group whose **intrinsic length is the ship's true metres**, base at `y=0`, bow toward **−Z**, `userData.heightM` set. `world.js`'s perceptual `setScalar` then works identically.
- Per-ship **materials are cloned**; **geometry + textures are shared** with one template (flagged `userData.shared`) so disposal never frees them.
- `ship-models-math.js` is pure (node-tested). `ship-models.js`/`world.js` import `three` (browser-only) → `node --check` + the user's visual check (bow direction confirmed there).

---

### Task 1: Vendor the glTF loader + commit the model

**Files:**
- Create: `public/vendor/three/GLTFLoader.js`, `public/vendor/three/BufferGeometryUtils.js`, `public/models/README.md`
- Commit (untracked): `public/models/lowpoly_cargoship.glb`

- [ ] **Step 1: Download the loader + its one dependency**

```bash
cd /c/Users/robertmoore/dev/BB45-ShipTracker
curl -sS -o public/vendor/three/GLTFLoader.js https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js
curl -sS -o public/vendor/three/BufferGeometryUtils.js https://unpkg.com/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js
```
Verify both are non-empty and JS: `wc -l public/vendor/three/GLTFLoader.js public/vendor/three/BufferGeometryUtils.js` (GLTFLoader ~4000+ lines).

- [ ] **Step 2: Fix GLTFLoader's relative import to the vendored location**

GLTFLoader imports `'../utils/BufferGeometryUtils.js'`; our copy sits beside it, so rewrite to `'./BufferGeometryUtils.js'`:
```bash
sed -i "s#'\.\./utils/BufferGeometryUtils\.js'#'./BufferGeometryUtils.js'#" public/vendor/three/GLTFLoader.js
```
Verify: `grep -n "BufferGeometryUtils" public/vendor/three/GLTFLoader.js` → must show `from './BufferGeometryUtils.js'` (no `../utils/`).

- [ ] **Step 3: Validate syntax**

Run: `node --check public/vendor/three/GLTFLoader.js && node --check public/vendor/three/BufferGeometryUtils.js`
Expected: no output (both parse). (They import bare `three`, resolved by the browser importmap — `node --check` only checks syntax.)

- [ ] **Step 4: Add the models README**

Create `public/models/README.md`:
```markdown
# Ship models

`lowpoly_cargoship.glb` — purchased low-poly cargo pack (one GLB, a `Scene` of 5 ships).
Used locally by the app; do not redistribute beyond this project.

Nodes → ship type (see `SHIP_MODELS` in `public/js/config.js`):

| Node | Ship | Mapped type |
|------|------|-------------|
| `boat1` | large container ship | `container` |
| `boat2` | smaller container ship | `coaster` |
| `boat3` | LNG carrier | (spare) |
| `boat4` | bulk/cargo carrier | `bulk` |
| `boat5` | oil tanker | `tanker` |

Each ship is modeled length +X, up +Y, beam +Z. `cruise`/`yacht` have no model here and use
the procedural meshes (`ship-meshes.js`); drop in more GLBs + manifest entries to cover them.
```

- [ ] **Step 5: Run the suite (imports guard) + commit**

Run: `npm test`
Expected: PASS (imports.test still green — `ship-models.js` doesn't exist yet; nothing references the loader).

```bash
git add public/vendor/three/GLTFLoader.js public/vendor/three/BufferGeometryUtils.js public/models/README.md public/models/lowpoly_cargoship.glb
git commit -m "chore(models): vendor GLTFLoader + commit purchased ship GLB"
```
(The GLB is ~22 MB and intentionally committed.)

---

### Task 2: `ship-models-math.js` — normalize transform + tests

**Files:**
- Create: `public/js/ship-models-math.js`
- Test: `public/js/ship-models-math.test.js`

- [ ] **Step 1: Write the failing tests**

Create `public/js/ship-models-math.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelTransform } from './ship-models-math.js'

test('modelTransform normalizes boat1 (length on X) to unit, base to waterline, bow yaw', () => {
  const t = modelTransform([-3.5, -0.6, -4.8], [3.9, 1.0, -3.5], 90)
  assert.ok(Math.abs(t.scale - 1 / 7.4) < 1e-9)            // 1 / lengthX
  assert.ok(Math.abs(t.offset[0] - -0.2) < 1e-9)           // centre x
  assert.ok(Math.abs(t.offset[1] - 0.6) < 1e-9)            // drop base (−min.y) to y=0
  assert.ok(Math.abs(t.offset[2] - 4.15) < 1e-9)           // centre z
  assert.ok(Math.abs(t.heightUnit - 1.6 / 7.4) < 1e-9)     // height / length
  assert.ok(Math.abs(t.yawRad - Math.PI / 2) < 1e-12)
})

test('modelTransform scale is always 1/lengthX and yaw follows bowYawDeg', () => {
  const t = modelTransform([0, 0, 0], [10, 2, 3], 270)
  assert.ok(Math.abs(t.scale - 0.1) < 1e-12)
  assert.ok(Math.abs(t.yawRad - 3 * Math.PI / 2) < 1e-12)
  assert.ok(Math.abs(t.heightUnit - 0.2) < 1e-12)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `./ship-models-math.js`.

- [ ] **Step 3: Implement `ship-models-math.js`**

Create `public/js/ship-models-math.js`:
```js
// Pure normalize math for glTF ship models (no three, so it unit-tests under node).
// Given a model's world AABB (length on +X, up +Y), returns the transform that makes a
// unit-length model centred in x/z, sitting on the waterline (y=0), bow yawed to −Z.
export function modelTransform(min, max, bowYawDeg) {
  const lengthX = max[0] - min[0]
  return {
    scale: 1 / lengthX,
    offset: [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2],
    yawRad: bowYawDeg * Math.PI / 180,
    heightUnit: (max[1] - min[1]) / lengthX
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/js/ship-models-math.js public/js/ship-models-math.test.js
git commit -m "feat(ship-models): pure normalize transform + tests"
```

---

### Task 3: Model manifest in `config.js`

**Files:**
- Modify: `public/js/config.js`

- [ ] **Step 1: Append the manifest**

At the end of `public/js/config.js`, add:
```js
// glTF ship models (purchased pack at public/models/). One GLB, a Scene of 5 named ship
// nodes; map the types we cover, others fall back to the procedural meshes. See
// docs/superpowers/specs/2026-06-15-glb-ship-models-design.md.
export const SHIP_MODELS = {
  file: 'models/lowpoly_cargoship.glb',
  nodes: { container: 'boat1', coaster: 'boat2', bulk: 'boat4', tanker: 'boat5' },
  bowYawDeg: 90   // rotate model length (+X) onto our bow (−Z); flip to 270 if ships face backward
}
```

- [ ] **Step 2: Validate + commit**

Run: `npm test` (PASS — nothing imports it yet) and `node --check public/js/config.js`.
```bash
git add public/js/config.js
git commit -m "feat(config): SHIP_MODELS manifest (node→type map + bow yaw)"
```

---

### Task 4: `ship-models.js` — load, normalize, serve per-ship clones

**Files:**
- Create: `public/js/ship-models.js`

Browser-only (imports `three` + the vendored loader). Validate with `node --check`.

- [ ] **Step 1: Create `ship-models.js`**

Create `public/js/ship-models.js`:
```js
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/three/GLTFLoader.js'
import { SHIP_MODELS } from './config.js'
import { modelTransform } from './ship-models-math.js'

// Loads the purchased GLB once and serves normalized per-type ship models matching
// makeShipMesh's contract (true-metre intrinsic length, base y=0, bow −Z, userData.heightM).
// Geometry + textures are shared across instances (flagged userData.shared); materials are
// cloned per ship so clip-plane/haze/emissive don't bleed. world.js falls back to procedural
// for unmapped types and until this finishes loading.
export function createShipModels() {
  const templates = new Map()   // type -> { group, heightUnit }
  let loaded = false

  new GLTFLoader().load(SHIP_MODELS.file, gltf => {
    for (const [type, nodeName] of Object.entries(SHIP_MODELS.nodes)) {
      const node = gltf.scene.getObjectByName(nodeName)
      if (!node) { console.warn('[ship-models] node not found:', nodeName); continue }
      const clone = node.clone(true)
      const box = new THREE.Box3().setFromObject(clone)
      const t = modelTransform(box.min.toArray(), box.max.toArray(), SHIP_MODELS.bowYawDeg)
      // recenter (xz) + drop base to waterline, then scale to unit length, then yaw to −Z
      const recenter = new THREE.Group(); recenter.add(clone)
      recenter.position.set(t.offset[0], t.offset[1], t.offset[2])
      const scaled = new THREE.Group(); scaled.add(recenter); scaled.scale.setScalar(t.scale)
      const tpl = new THREE.Group(); tpl.add(scaled); tpl.rotation.y = t.yawRad
      tpl.traverse(o => {                          // flag shared resources (never disposed)
        if (o.geometry) o.geometry.userData.shared = true
        if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material]))
          if (m.map) m.map.userData.shared = true
      })
      templates.set(type, { group: tpl, heightUnit: t.heightUnit })
    }
    loaded = true
  }, undefined, err => console.warn('[ship-models] load failed:', err))

  return {
    modelReady: type => loaded && templates.has(type),
    makeShipModel(s) {
      const tpl = templates.get(s.type); if (!tpl) return null
      const len = s.len || 80
      const inner = tpl.group.clone(true)
      inner.traverse(o => {                         // per-instance materials (shared geometry/maps stay)
        if (o.material) o.material = Array.isArray(o.material)
          ? o.material.map(m => m.clone()) : o.material.clone()
      })
      inner.scale.multiplyScalar(len)               // unit template → true metres
      const outer = new THREE.Group(); outer.add(inner)
      outer.userData.heightM = tpl.heightUnit * len
      outer.userData.isModel = true
      return outer
    }
  }
}
```

- [ ] **Step 2: Validate**

Run: `node --check public/js/ship-models.js` → no output.
Run: `npm test` → PASS (no test imports it).

- [ ] **Step 3: Commit**

```bash
git add public/js/ship-models.js
git commit -m "feat(ship-models): load GLB, normalize 5 ship nodes, serve per-ship clones"
```

---

### Task 5: Wire models into `world.js`

**Files:**
- Modify: `public/js/world.js`

- [ ] **Step 1: Import the model factory**

After the line `import { makeShipMesh, makeWake, shipMaterials } from './ship-meshes.js'`, add:
```js
import { createShipModels } from './ship-models.js'
```

- [ ] **Step 2: Create the model factory next to the ship layer**

Find:
```js
  const shipLayer = new THREE.Group(); scene.add(shipLayer)
  const meshes = new Map()
```
Replace with:
```js
  const shipLayer = new THREE.Group(); scene.add(shipLayer)
  const meshes = new Map()
  const shipModels = createShipModels()
  // Model if its GLB is loaded for this type, else the procedural mesh (also during async load).
  const makeShip = s => shipModels.modelReady(s.type) ? shipModels.makeShipModel(s) : makeShipMesh(s)
```

- [ ] **Step 3: Use `makeShip` + upgrade procedural→model when it loads**

Find:
```js
      if (!sp || sp.userData.type !== s.type || sp.userData.len !== len) {
        if (sp) { shipLayer.remove(sp); disposeShip(sp) }
        sp = makeShipMesh(s)
```
Replace with:
```js
      if (!sp || sp.userData.type !== s.type || sp.userData.len !== len ||
          (shipModels.modelReady(s.type) && !sp.userData.isModel)) {
        if (sp) { shipLayer.remove(sp); disposeShip(sp) }
        sp = makeShip(s)
```

- [ ] **Step 4: Guard the colour writes for arbitrary model materials**

Find:
```js
        for (const m of sp.userData.materials) {
          m.clippingPlanes = [sp.userData.clip]
          m.fog = false                                // ships use perceptual haze, not scene FogExp2
          m.userData.baseColor = m.color.clone()       // remember the un-hazed colour
          if (m.emissive) m.emissive.setHex(0x223038)  // fixed moonlit tint; only intensity varies
          m.needsUpdate = true
        }
```
Replace with:
```js
        for (const m of sp.userData.materials) {
          m.clippingPlanes = [sp.userData.clip]
          m.fog = false                                // ships use perceptual haze, not scene FogExp2
          if (m.color) m.userData.baseColor = m.color.clone()  // remember the un-hazed colour
          if (m.emissive) m.emissive.setHex(0x223038)  // fixed moonlit tint; only intensity varies
          m.needsUpdate = true
        }
```

Then find the per-frame haze loop:
```js
      for (const m of sp.userData.materials) {
        m.color.copy(m.userData.baseColor).lerp(haze, 1 - clarity)
        if (m.emissive) m.emissiveIntensity = emis
      }
```
Replace with:
```js
      for (const m of sp.userData.materials) {
        if (m.userData.baseColor) m.color.copy(m.userData.baseColor).lerp(haze, 1 - clarity)
        if (m.emissive) m.emissiveIntensity = emis
      }
```

- [ ] **Step 5: Respect shared resources in `disposeShip`**

Replace:
```js
  function disposeShip(sp) {
    sp.traverse(o => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose() }
    })
  }
```
with:
```js
  function disposeShip(sp) {
    sp.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose()
      if (o.material) {
        if (o.material.map && !o.material.map.userData.shared) o.material.map.dispose()
        o.material.dispose()
      }
    })
  }
```

- [ ] **Step 6: Validate**

Run: `node --check public/js/world.js` → no output.
Run: `grep -n "makeShipMesh\|makeShip\b\|isModel\|userData.shared" public/js/world.js` → confirm `makeShip` is used in the creation block, `makeShipMesh` still imported (fallback), the upgrade condition references `isModel`, and `disposeShip` checks `userData.shared`.
Run: `npm test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add public/js/world.js
git commit -m "feat(world): render glTF ship models with procedural fallback + async upgrade"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Suite + syntax**

Run: `npm test`
Expected: PASS, 0 failures (≈ 96 tests: prior 94 + 2 modelTransform).
Run: `node --check public/js/ship-models.js && node --check public/js/world.js && node --check public/vendor/three/GLTFLoader.js`
Expected: all OK.

- [ ] **Step 2: Confirm wiring**

Run: `grep -rn "lowpoly_cargoship\|SHIP_MODELS\|createShipModels" public/js`
Expected: manifest in `config.js`, factory created/used in `world.js`, loaded in `ship-models.js`.

- [ ] **Step 3: Visual check (user, host-side)**

`git pull`, refresh. After the 22 MB GLB loads:
- **container, coaster, bulk, tanker** render as the real low-poly models (cruise/yacht stay procedural).
- They're **sized** by the perceptual rule (use the Calibration sliders if needed), **grounded** with wake + reflection, **hull-down + haze + night emissive** still work.
- They **face their course.** If they look like they're sailing backward, tell me and I flip `SHIP_MODELS.bowYawDeg` 90 → 270 (one number).
- Briefly at load they're procedural, then upgrade to models.

- [ ] **Step 4: Update project memory**

After the user confirms (incl. bow direction), update the BB45 project memory: glTF ship models BUILT (purchased pack vendored at `public/models/`, `ship-models.js` + `ship-models-math.js`, GLTFLoader vendored, 4 types modeled + cruise/yacht procedural fallback); note the final `bowYawDeg`, and remaining threads (haze punch-up, baking calibration values + Size range, look-toward zoom, cruise/yacht models).

---

## Notes for the implementer

- **Bow direction** (`bowYawDeg`) and any **per-model scale oddity** are the only things needing the user's eyes; everything else is mechanical.
- **Don't dispose shared resources** — the `userData.shared` flags on template geometry/textures are load-bearing; the wake (per-instance) is intentionally not flagged so it still frees.
- `ship-meshes.js` stays — it's the fallback for cruise/yacht/unmapped types and during the async load.
- Out of scope (separate threads): haze punch-up, baking tuned calibration values + Size-slider range, look-toward zoom, cruise/yacht models.
