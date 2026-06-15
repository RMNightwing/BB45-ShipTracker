# glTF ship models — real low-poly hulls from a purchased pack, with procedural fallback

Date: 2026-06-15
Status: design approved (brainstorm), ready to plan

## Why

The procedural box meshes read as "models," not real ships. The user purchased a cohesive
low-poly cargo pack and placed it at `public/models/lowpoly_cargoship.glb`. We render the real
models for the types the pack covers, keep the procedural meshes as the fallback for the rest, and
flow everything through the existing perceptual size / heading / wake / haze / hull-down path so the
fleet stays consistent. Models are swappable data — a future pack (incl. cruise/yacht) drops in
with no code change.

## What's in the file (inspected)

One GLB (~22 MB), a `Scene` with five top-level ship nodes, each modeled **length along +X, up +Y,
beam along +Z** (Y-up). World-space dimensions (model units), length = X:

| Node | Ship | dims x,y,z |
|------|------|------------|
| `boat1` | large container ship | 7.35 × 1.58 × 1.26 |
| `boat2` | smaller container ship | 8.99 × 1.69 × 1.19 |
| `boat3` | LNG carrier | 8.05 × 1.65 × 1.27 |
| `boat4` | bulk/cargo carrier | 9.35 × 1.36 × 1.30 |
| `boat5` | oil tanker | 9.35 × 1.36 × 1.62 |

20 materials, 8 textures.

## Locked decisions (from the brainstorm)

- **Real models for 4 types, procedural fallback for the rest.** Mapping: `container→boat1`,
  `coaster→boat2`, `bulk→boat4`, `tanker→boat5`. `boat3` (LNG) kept as a spare/unknown-cargo option.
  **`cruise` and `yacht` have no model in this pack → procedural mesh** (type-accurate; swap in
  models later). Live AIS types not in the map → procedural.
- **Commit the GLB** (user's call — single user, wants max accuracy always; do NOT gitignore).
- **Same downstream path.** Models normalize to the same contract as `makeShipMesh` (a group whose
  intrinsic length is the ship's true metres, base at `y=0`, bow toward −Z, `userData.heightM` set),
  so perceptual size, heading, wake, haze, and hull-down all apply unchanged.
- **`ship-meshes.js` stays** as the fallback — this wraps it, doesn't replace it.

## Architecture

### 1. Vendor the loader
- `public/vendor/three/GLTFLoader.js` (Three r160 examples) — its one relative import
  `../utils/BufferGeometryUtils.js` is rewritten to `./BufferGeometryUtils.js`.
- `public/vendor/three/BufferGeometryUtils.js` (imports bare `three` only).
- Both resolve via the existing importmap (`three`) like `Water.js`/`Sky.js`. `ship-models.js`
  imports `from '../vendor/three/GLTFLoader.js'` (module-relative, per the imports.test guard).

### 2. Manifest — `config.js`
```js
export const SHIP_MODELS = {
  file: 'models/lowpoly_cargoship.glb',
  nodes: { container: 'boat1', coaster: 'boat2', bulk: 'boat4', tanker: 'boat5' },
  bowYawDeg: 90   // rotate model +X (length) onto −Z (bow); flip to 270 if ships face backward
}
```

### 3. Pure math — `ship-models-math.js` (no three, unit-tested)
`modelTransform(min, max, bowYawDeg) → { scale, yawRad, offset:[x,y,z], heightUnit }`:
- `scale = 1 / (max[0]−min[0])` (normalize length-on-X to unit).
- `offset = [−(min[0]+max[0])/2, −min[1], −(min[2]+max[2])/2]` (centre x/z, drop base to y=0).
- `yawRad = bowYawDeg·π/180`.
- `heightUnit = (max[1]−min[1]) / (max[0]−min[0])` (height as a fraction of length).

### 4. Loader/normalizer — `ship-models.js` (browser)
`createShipModels()` returns `{ makeShipModel(s), modelReady(type) }`:
- Loads `SHIP_MODELS.file` once via `GLTFLoader`. On success, for each mapped type: `getObjectByName(node)`,
  clone it, `Box3.setFromObject` → `modelTransform(...)`, and build a **unit template** = a group that
  recenters the clone by `offset`, scales by `scale`, and yaws by `yawRad` (length→−Z). Store the
  template + `heightUnit` per type; mark `loaded`. When building each template, tag its shared
  resources: `mesh.geometry.userData.shared = true` and (if present) `material.map.userData.shared = true`,
  so disposal of per-ship clones never frees them.
- `modelReady(type)` → true once loaded and `type` is in the map.
- `makeShipModel(s)` → an **outer group**; inner = `template.clone()` then **traverse and replace each
  `o.material` with `o.material.clone()`** (per-instance materials so clip plane / haze / emissive don't
  bleed between ships). Geometry and textures (`map`) stay **shared** with the template (clone() shares
  them — don't deep-copy 22 MB per ship). `inner.scale.multiplyScalar(s.len)` so intrinsic length = `len`
  metres; `outer.userData.heightM = heightUnit · s.len`; `outer.userData.isModel = true`. (Outer scale
  stays 1; `world.js` sets it via the perceptual rule, matching the procedural contract.)

### 5. world.js wiring
- `const shipModels = createShipModels()` near the ship layer.
- A `makeShip(s)` helper: `shipModels.modelReady(s.type) ? shipModels.makeShipModel(s) : makeShipMesh(s)`.
  Use it where `updateShips` currently calls `makeShipMesh(s)`.
- Rebuild a ship when `!sp || type changed || len changed || (shipModels.modelReady(s.type) && !sp.userData.isModel)`
  — so ships drawn procedurally before the (async) GLB loads upgrade to the model once ready.
- Everything else (`shipMaterials` traversal for clip plane + `m.fog=false` + `baseColor` + emissive,
  perceptual `apparentAngle`/`renderedDistanceKm` scale/placement, wake, `heightM`-based clip) is
  unchanged — it already operates on "a group + its materials," which models satisfy.
- **Disposal:** `disposeShip` skips resources flagged shared, so it works for both models and
  procedural+wake: `if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose()`; for materials,
  `if (o.material.map && !o.material.map.userData.shared) o.material.map.dispose(); o.material.dispose()`.
  Template geometry/textures are flagged shared (skipped); per-instance materials, procedural geometry,
  and the wake (geometry+texture) are not flagged → freed normally.

### 6. Data folder
- `public/models/lowpoly_cargoship.glb` committed. `public/models/README.md` credits the pack
  (purchased; source + that it's used locally) and records the `boat#`→type mapping.

## Testing

Pure (`node --test`, TDD) in `ship-models-math.test.js`:
- `modelTransform` with `boat1` dims (min `[-3.5,-0.6,-4.8]`, max `[3.9,1.0,-3.5]`): `scale ≈ 1/7.4`,
  `offset` centres x/z and lifts base to 0 (`offset[1] = 0.6`), `heightUnit ≈ 1.58/7.35`,
  `yawRad = π/2` for `bowYawDeg=90`. Plus: scale always `1/lengthX`; `bowYawDeg` 270 → `3π/2`.

Visual-only (host `npm start`): the four types render as real cohesive models, correctly sized
(perceptual rule), grounded on the water with wake + reflection, hull-down + haze working, and
**facing their course** — if they face backward, flip `bowYawDeg` 90↔270 (one constant). Cruise/yacht
still procedural. Before the 22 MB GLB finishes loading, ships render procedurally then upgrade.

## Acceptance

- container/coaster/bulk/tanker render as the real low-poly models, oriented to course, sized by the
  perceptual rule, grounded (wake/reflection), with hull-down + haze + night emissive intact.
- cruise/yacht render as procedural meshes (fallback); nothing breaks for unmapped/live types.
- `npm test` green incl. the new `modelTransform` tests; `imports.test` green (vendored loader paths).
- The GLB loads from `public/models/` and is committed.

## Out of scope (later / separate)

- Cruise/yacht (and any nicer) models — drop into `public/models/`, add manifest entries.
- Per-model material/lighting polish if the pack's PBR clashes with the stylized sea.
- Threads still open: haze punch-up, baking tuned calibration values + Size-slider range, look-toward zoom.
