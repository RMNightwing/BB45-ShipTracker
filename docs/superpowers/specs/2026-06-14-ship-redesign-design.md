# Ship redesign — distinct procedural silhouettes, honest distance spread, day/night legibility

Date: 2026-06-14
Status: SUPERSEDED by `2026-06-14-ship-3d-meshes-design.md`. This spec targeted the
pre-migration 2D `drawShip`/canvas-silhouette renderer. The Three.js migration replaced that
renderer with billboard sprites, and the 3D-meshes spec replaces the billboards with real 3D
geometry — carrying forward this spec's per-type signatures, `EXAGGERATION` spread idea, and
distance-fade, but dropping its 2D-specific contrast-floor/rim/LOD mechanics (lighting +
perspective handle those now). Kept for history.

(original) Status: design approved (via `public/mockups/ships.html`), ready to plan

## Why

The simulated fleet (which shares `drawShip`/silhouettes with live AIS ships) had three
problems the user raised looking at the real app:

1. **Bunched** — the sim fleet spawns into a narrow 4–11 km band (`sim.js`), so every ship
   renders at nearly the same apparent size *and* the same vertical height: a flat, stacked
   row with no sense of distance.
2. **Too small / hard to see** — by day the ships are faint and tiny; at night a dark hull
   (`PALETTE.ship` `#1e3a44`) on the near-black sea is effectively invisible.
3. **Silhouettes don't read as distinct** — the crude `fillRect` shapes differ only by their
   "topping," not by overall proportion, so types aren't recognizable at a glance.

This work fixes all three for the **simulated** fleet now (no live ships needed), and because
sim + live share the renderer, it also sets up **milestone 5** (AIS type→silhouette,
MMSI→flag) — the identity mapping is the only remaining live-specific piece.

## Locked decisions (from the brainstorm)

- **Procedural, not images.** Ships span a few px to large, face either heading, and cover 7+
  type buckets — procedural shapes stay crisp at any scale and mirror for course direction for
  free. (Images would blur when scaled, face one way, and need 7+ sourced assets.)
- **Honest spread, exact physics preserved.** `bearing→x` and `distance→apparent-size` stay
  exact. The fix is to widen where the sim ships *are*, not to fake their size. The only
  stylized lever remains the vertical `EXAGGERATION` nudge (already sanctioned).
- **Flags + identity live in the hover label only.** You cannot see a flag on a hull km away;
  painting one on the silhouette would be both invisible-when-honest and unfaithful. The
  existing sticky-hover tooltip already carries flag · name · type · dest · distance · bearing.
- **Night visibility = contrast floor + thin rim** (not nav lights — those are parked for the
  final milestone). Lift the silhouette value just enough to stand off the background, plus a
  1 px contrasting rim. Faithful-ish, still moody.

## The design

### 1. Distinct procedural silhouettes

Rewrite the `SILHOUETTES` painters in `ships.js`. Each painter draws into a unit box
(`x: 0..w`, waterline at `y=0`, up = negative) and takes a `detail` level (0..1) and a
resolved palette. Types differ by **proportion + signature feature**, not just topping:

| Type        | Signature                                              | Proportion        |
|-------------|--------------------------------------------------------|-------------------|
| `container` | colorful stacked box bays, bridge/funnel aft           | wide, medium tall |
| `tanker`    | flat deck, midship manifold/catwalk, single stern block| long & low        |
| `bulk`      | bristling pedestal deck cranes between hatch coamings  | medium            |
| `cruise`    | tall bright wall of windowed decks, funnel             | longest, tallest  |
| `coaster`   | single hatch + derrick, stern-heavy                    | stubby, chunky    |
| `yacht`     | sleek raked white hull, low superstructure, radar arch | tiny, very low    |
| `fishing`   | wheelhouse forward, A-frame gantry aft                 | tiny workboat     |

A `default`/general-cargo bucket backs unknown AIS codes. The mockup
(`public/mockups/ships.html`) is the visual reference for these shapes.

### 2. Detail level-of-detail (LOD)

Internal shading, container colors, window rows, crane jibs, etc. only draw when the ship's
apparent width is large (close). As a ship recedes, `detail` falls to 0 and the silhouette
collapses to a single flat mass — which is what a distant ship actually looks like. This keeps
faithfulness and avoids noise on far ships. `detail = clamp((apparentWidthPx - LOD_MIN_PX) / LOD_RANGE, 0, 1)`.

### 3. Day/night legibility — contrast floor + rim

`drawShip` must know the scene's ambient/background so it can keep the silhouette legible.
Thread the per-frame `env` (already built in `main.js` from the dynamic-sky work — it has
`ambient` and the sea/sky colors) into `drawShip`.

- **Fill value floor:** when ambient is low (night), mix the ship palette toward a lifted
  slate so it stands off the dark sea; by day keep the faithful dark silhouette. Driven by
  `ambient`, not a hard day/night flag, so dusk interpolates.
- **Rim:** stroke the hull (and main superstructure) outline with a 1 px contrasting color —
  a light "moonlit" rim at night, a faint dark rim by day — so the shape's edge always reads.
- **Distance haze still fades the far edge.** The floor governs *value contrast* (night
  visibility); the existing `hazeAlpha` still lets a genuine far-edge ship fade to "barely
  visible." These are independent: a mid-range night ship is lifted-but-solid; the 38 km edge
  ship is faint regardless.

### 4. Honest distance spread (the separation fix)

Sim-data + two constants. Exact physics untouched.

- **Spread the sim fleet across the full visible range** — `sim.js` `recycle()` and the `SEED`
  distances go from ~3 km (right off the coast: big, crisp, low) out to the ~38 km hull-down
  cull edge (a faint, hull-cut smudge). Ships genuinely sit at different ranges, so size +
  vertical position vary — *that contrast is the distance cue.*
- **Bump `EXAGGERATION` 0.3 → 0.5** (vertical nudge only) so the near/far vertical separation
  reads more dramatically.
- **Add `MIN_SHIP_PX` floor** (~5 px) so the farthest ship is a tiny smudge, not a sub-pixel
  that vanishes before the honest cull.
- **Hull-down already handled** by `hullDownState`/the clip in `drawShip` — the far-edge ship
  correctly shows superstructure-only above the horizon.

### 5. Identity (label only)

No horizon change. For live ships (milestone 5, follow-on), derive the flag emoji from the
MMSI MID and the silhouette bucket from the AIS numeric type code; sim ships already carry
`flag`/`type`. The tooltip in `ui.js` already renders flag · name · type · dest · distance ·
bearing · kn · len, so this is data wiring, not a render change.

## Files touched

- `public/js/ships.js` — rewrite `SILHOUETTES` painters (distinct, `detail`-aware, rimmed);
  `drawShip` takes `env`, applies the contrast-floor fill + rim + LOD + `MIN_SHIP_PX`.
- `public/js/config.js` — `EXAGGERATION` → 0.5; add `MIN_SHIP_PX`, `LOD_MIN_PX`/`LOD_RANGE`,
  and the night contrast/rim constants; document the type-bucket list.
- `public/js/sim.js` — widen `recycle()` and `SEED` distances to the full ~3–38 km range.
- `public/js/main.js` — pass `env` into the `drawShip` call.
- (Mockup `public/mockups/ships.html` is the throwaway visual reference; not shipped logic.)

## Testing

Pure, unit-testable (node `--test`, TDD):
- contrast-floor helper: returns a lifted fill at low ambient, the faithful dark fill at high
  ambient, monotonic between.
- `MIN_SHIP_PX` floor applied to `apparentWidthPx`.
- `detail` LOD mapping (0 when small, 1 when large, clamped).
- sim spread: a recycled/seeded fleet covers a wide distance range (assert min/max span), all
  within the view arc.
- (m5 follow-on) MMSI MID → flag and AIS type code → bucket mappings.

Visual-only (judge in the mockup / real app): the silhouette shapes themselves, the night
look, the felt distance spread.

## Acceptance

- The 7 types are distinguishable at a glance in the type sheet and at close range in-app.
- In-app the fleet visibly spans near→far: at least one big near ship and one faint hull-down
  edge ship on screen, with clear size/height variation between.
- Ships are legible at night (lifted + rimmed) without looking like daylight; the far edge
  still fades.
- Day silhouettes remain faithfully dark; exact bearing/size physics unchanged (tests green).

## Out of scope — parked for the FINAL milestone (do NOT build here)

User-decreed final milestone, to revisit last: **glanceable on-screen ship info** — flag and
ship **name drawn on each mini replica**, any knowable details surfaced at a glance — plus a
general UI realism / "hyper-real" spruce-up (candidate home for nav/running lights, wakes,
reflections, etc.).
