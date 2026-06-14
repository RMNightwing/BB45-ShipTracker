# Ship 3D meshes — procedural low-poly hulls, heading-aware, fan-out placement, wake

Date: 2026-06-14
Status: design approved (brainstorm), ready to plan
Supersedes: `2026-06-14-ship-redesign-design.md` (that spec targeted the pre-migration 2D
`drawShip`/canvas-silhouette renderer; the Three.js migration replaced it with billboard
sprites, and this spec replaces the billboards with real 3D meshes).

## Why

Looking at the migrated 3D app, the user raised four things about the simulated fleet, plus
two scene notes:

1. **Always broadside** — ships are flat side-profile **billboard sprites** turned to face the
   camera, so every vessel shows its full beam regardless of its actual heading.
2. **Silhouette style/detail** — the flat pasted-on profiles read as illustrations, not objects
   in the world.
3. **Scale** — apparent size feels off; the 2D-era `SIZE_CAP_FRAC`/`MIN_SHIP_PX` cap logic
   fights real perspective.
4. **Grounding** — ships don't sit *in* the water; no wake, no reflection, hull meets water
   unconvincingly.
5. **Stuck at the edge** — every ship clusters in a thin band at the horizon, leaving the large
   foreground "swath" of water empty.
6. **Fake shadow** — a dark gradient baked into the bottom of each silhouette reads as a grimy
   drop-shadow the user dislikes.

Root cause of 1–4 and 6 is the same: ships are flat billboards with baked shading. Root cause
of 5 is that the migration dropped the spec's `EXAGGERATION` vertical nudge — the view is now
100% physically true, and from a 32 m deck all realistic ship distances (2–24 km) compress into
~0.85° of arc right at the horizon.

Because sim + live AIS ships share the renderer, this also sets up **milestone 5** (type→mesh,
MMSI→flag): the identity mapping is the only remaining live-specific piece.

## Locked decisions (from the brainstorm)

- **Low-poly 3D meshes, not billboards.** Real procedural geometry makes heading/foreshortening,
  true-metre scale, water reflection, and lighting all correct automatically. Accepts a shift
  from the illustrative look to a "model" look; mitigated by keeping per-type signatures.
- **Stylized vertical fan-out**, exact physics preserved. `bearing→azimuth` and
  `distance→apparent-size` stay exact; the only stylized lever is the vertical nudge (sanctioned
  by the design doc). Hull-down onset stays physically exact (uses true distance).
- **Wake is in** (user explicitly wants it) — not optional.
- **No shadows.** Shadow maps stay off; no baked dark gradient. Grounding comes from reflection
  + wake, not a fake drop-shadow.
- **Keep distance-based visibility.** The `FogExp2` haze (from the Koschmieder sightline) plus
  hull-down fade is a wanted depth cue — the new meshes fog identically.
- **Lighting does day/night.** The scene already drives `sunLight.intensity` from sun elevation
  + ambient, so lit meshes darken at dusk and go moonlit-dim at night for free. The hand-tuned
  `nightLift`/palette-mixing in `ships.js` is retired; a faint emissive keeps ships off pure
  black at deep night.

## The design

### 1. Architecture

New module **`public/js/ship-meshes.js`** replaces **`public/js/ship-sprites.js`** (deleted).
`makeShipMesh(type)` returns a procedural low-poly `THREE.Group` in a **local frame**: `+X` =
bow (forward), origin at the **waterline center**, `+Y` = up, built in **true metres**. Hull is
a simple extruded/box shape; superstructure and signature features are boxes. Per-ship material
instances (cloned from per-type templates) so each ship can carry its own clip plane (hull-down)
and emissive.

The 2D `SILHOUETTES` painters in `ships.js` are **retired** (the mesh builders inherit their
proportions + signatures). Kept in `ships.js`: hit-testing (`padRect`, `shipAtPoint`) and any
pure type metadata. `nightLift`/`shipPalette`/`lodDetail` are removed (lighting + perspective
replace them) unless a test still needs a pure helper.

### 2. Per-type mesh builders (the boat design)

Each type keeps a recognizable, low-poly signature ported from the old silhouettes:

| Type        | Signature (low-poly)                                        | Proportion        |
|-------------|------------------------------------------------------------|-------------------|
| `container` | flat hull + colored container-stack boxes + aft house      | wide, medium tall |
| `tanker`    | smooth deck, midship manifold bump, tall aft superstructure| long & low        |
| `bulk`      | hatch coamings + thin crane masts/booms                    | medium            |
| `cruise`    | white tiered superstructure block + funnel(s), window band | longest, tallest  |
| `coaster`   | small hull + compact wheelhouse, stern-heavy               | stubby, chunky    |
| `yacht`     | low sleek hull + small wheelhouse/arch                      | tiny, very low    |

A `default`/general-cargo bucket backs unknown AIS codes (m5). Window rows / fine detail are a
cheap texture or thin dark bands, not extra geometry.

Materials: `MeshStandardMaterial` (or Lambert) with base hull/deck/box colors. Day/night is the
scene lighting; a small `emissiveIntensity` lifts ships at deep night for legibility.

### 3. Fan-out placement (the "stuck at the edge" fix)

Keeps **bearing and apparent size exact**; only vertical position changes, by pulling near ships
*closer along their own sight-ray* and scaling them down to compensate:

- `f = 1 − EXAGGERATION · nearness(d)` — `nearness(d, NEAR_KM, FAR_KM)` (already in
  `geometry.js`, currently unused) is 1 for the nearest ships, 0 at `FAR_KM`.
- Ground position = `camera_ground + f · (ship_ground − camera_ground)` → same azimuth, larger
  depression angle → **lower in the frame**.
- Mesh scaled by `f` → angular (apparent) size identical to the true-distance size.
- **Hull-down uses true distance `d`**, not the warped one, so far ships stay pinned at the real
  horizon and hull-down onset remains physically exact.

`EXAGGERATION` is a tunable in `config.js` (the old constant, reborn for 3D). A pure helper
`fannedPlacement(eyeENU, shipENU, distanceKm)` → `{ e, n, scale }` lives in `geometry.js` so the
warp math is **unit-tested under Node** (the WebGL render is not).

### 4. Grounding: reflection, hull-down, wake

- **Reflection** is free — the existing `Water` object reflects scene meshes.
- **Hull-down** via a per-ship horizontal **clipping plane** that rises with `clipFrac`
  (`hullDownState`), cutting the lower hull from the bottom up as the ship recedes — replaces the
  old texture clip. Requires `renderer.localClippingEnabled = true` and per-ship materials.
- **Wake** — a thin, elongated translucent foam plane laid on the water (`y ≈ small ε` to avoid
  z-fighting) behind the ship along its heading; length/alpha scale with speed (`kn`). A soft
  gradient texture (bright at the stern, fading aft). Fogged like everything else.

### 5. Scale / cap

True-metre meshes + perspective give correct apparent size. The 2D-era `SIZE_CAP_FRAC` /
`MIN_SHIP_PX` cap logic is dropped (or kept only as a far-distance legibility guard so the
farthest ship is a faint smudge, not sub-pixel, before the honest hull-down cull). A 300 m
container reads as 300 m.

### 6. world.js wiring

`updateShips(ships, env)` reworked: reuse a mesh per ship `id`; set fan-out ground position
(`y = 0`), `rotation.y = −toRad(s.course)` (compass→ENU heading), uniform `scale = f`; update the
per-ship clip-plane height from `clipFrac`; update/position the wake. Remove all texture-rebuild
logic. `shipScreenRects()` keeps projecting the mesh position (a point) for hover/tooltip.

### 7. Identity (label only)

No horizon change. Sim ships already carry `flag`/`type`; the `ui.js` tooltip already renders
flag · name · type · dest · distance · bearing · kn · len. For live ships (m5, follow-on),
derive flag from MMSI MID and the mesh bucket from the AIS numeric type code.

## Files touched

- **`public/js/ship-meshes.js`** — NEW. `makeShipMesh(type)` per-type low-poly builders +
  per-ship material/clip-plane setup; wake builder.
- `public/js/ship-sprites.js` — DELETE.
- `public/js/ships.js` — retire `SILHOUETTES`/`nightLift`/`shipPalette`/`lodDetail`; keep
  hit-testing + type metadata.
- `public/js/geometry.js` — add `fannedPlacement` pure helper (uses existing `nearness`).
- `public/js/world.js` — rework `updateShips`; enable `localClippingEnabled`; wake; keep
  `shadowMap` off.
- `public/js/config.js` — add `EXAGGERATION` and `NEAR_KM`; drop/relax `SIZE_CAP_FRAC` /
  `MIN_SHIP_PX`; document the type-bucket list.
- Tests: new `geometry`/`ship-meshes` pure tests; update/remove `ships.test.js` and any
  sprite-coupled tests.

## Testing

Pure, unit-testable (`node --test`, TDD):
- `fannedPlacement`: bearing preserved (azimuth of result == azimuth of input), apparent size
  preserved (`scale / resultDistance == 1 / trueDistance`), `f == 1` at the far edge
  (`nearness == 0`), monotonic with distance.
- `nearness` mapping (already covered) at `NEAR_KM`/`FAR_KM` bounds.
- Any pure mesh proportion/dimension math exposed from `ship-meshes.js`.
- Hull-down `clipFrac` → clip-plane height mapping.

Visual-only (judge in the real app, host-side `npm start` per the localhost note): the mesh
shapes, heading orientation/foreshortening, the felt fan-out spread across the foreground, wake,
reflection, day→night lighting, no fake shadow.

## Acceptance

- Ships are recognizable low-poly objects oriented to their course (a ship heading toward/away
  looks foreshortened, not full-broadside).
- The fleet visibly fans across the foreground→horizon: at least one big near ship low in the
  frame and one faint hull-down edge ship near the horizon, with clear vertical + size variation.
- Ships sit *in* the water — visible reflection and a speed-scaled wake; no baked drop-shadow.
- Day/night lighting reads naturally; deep-night ships stay legible (emissive floor); the far
  edge still fades via haze + hull-down.
- Exact bearing/apparent-size physics unchanged (pure tests green).

## Related follow-up (separate spec — do NOT build here)

- **Full sweep (max) view is distorted.** The wide `CylindricalProjection` renders black (open
  bug), so the code falls back to a 156° perspective camera that stretches grotesquely at the
  edges. The user wants the cylindrical projection **fixed** (real undistorted sweep). This is a
  debugging task (root-cause the black screen) and gets its own spec/session.

## Out of scope — parked for the FINAL milestone

Glanceable on-screen ship info (flag + name drawn on each replica) and nav/running lights — to
revisit last, per the user's earlier decree.
