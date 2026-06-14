# Static perceptual ship model — size/spread/haze tuned to perception, not optics

Date: 2026-06-14
Status: design approved (brainstorm), ready to plan

## Why

The app's founding tenet was *optical faithfulness*: true bearing → horizontal position, true
distance → apparent size, only the vertical axis stylized. That is exactly what a pinhole lens
at a fixed field of view captures — but a lens is not an eye. The eye **foveates** (attention
zooms onto a noticed ship) and applies **size constancy** (the brain partly cancels distance, so
far objects don't shrink as hard as optics dictates). So the optically-correct render is
simultaneously *perceptually wrong*: ships read as insignificant smudges, the depth feels flat,
and haze veils shapes the eye would pick out.

The user confirmed the gap is on **all** of: ship size, depth/spread, and haze. (Viewing width
is fine — it matches the real deck arc — so FOV is NOT changed here; the wide-view edge
distortion is a separate, already-planned cylindrical-projection fix.)

This spec introduces a thin **perceptual layer** between the true world and the render. It is the
**static** half of an agreed two-step plan:
1. **(this spec)** the static frame is tuned so the wide view already reads like the real bay.
2. **(follow-up spec)** an optional "look-toward" zoom foveates further on a chosen ship, tuned
   to feel continuous with the static look.

## Locked decisions (from the brainstorm)

- **Bearing stays exact — it is the anchor.** Horizontal position = true bearing, never faked.
  This is the one thing the eye genuinely gets right, and keeping it honest is what stops the
  model from becoming an arbitrary "looks nice" impression.
- **Three perceptual rules replace three physical laws** (size, depth-spread, haze). Each is a
  principled, monotonic mapping (bigger ship → bigger; nearer → bigger/lower; farther → hazier),
  not an ad-hoc fudge — so it stays a *model of perception*, not decoration.
- **Size is decoupled from field of view.** This is the core move: ship size comes from a
  perceptual rule, not from true angular size on a wide lens, so ships are big and clear even in
  the faithful full-width view. FOV is unchanged.
- **Tune by eye, hybrid storage.** Values live as `config.js` constants (canonical, version
  controlled, work with no UI). A dev "Calibration" slider group, initialized from those
  constants and updating them live, gives a fast solo tuning loop against the real bay. Sliders
  are a tuning aid over the constants, removable later — not the source of truth.
- **Keep what already works:** hull-down (keyed off TRUE distance), water reflection, wake,
  scene lighting (day/night), and the atmospheric fog for sky/sea/Venezuela are untouched.

## The model

For each ship the pipeline is: true bearing fixes the azimuth ray; the **depth rule** chooses how
far down that ray to place it (vertical position); the **size rule** chooses its on-screen size
(applied as mesh scale, independent of placement); the **haze rule** chooses its clarity. Size and
vertical position are thus fully independent stylized axes; bearing is exact.

### Rule 1 — Size (size constancy)

Replaces `apparent = length / distance`. Output is a **target angular size** (radians):

```
apparentAngle(lengthM, trueKm) = clamp(
  SIZE_GAIN * lengthM / trueKm^(1 - SIZE_CONSTANCY),
  MIN_ANGLE, MAX_ANGLE)
```

- **`SIZE_GAIN`** — overall magnification ("Size" slider). Absorbs units; tuned by eye.
- **`SIZE_CONSTANCY` ∈ [0,1]** — `0` = pure optics (`∝ 1/distance`, far ships tiny); `1` = full
  constancy (size depends only on `lengthM`, distance irrelevant); ~`0.4` = partial constancy
  (far ships lifted into legibility, nearer still larger). Config constant (promotable to a 4th
  slider if needed).
- **`MIN_ANGLE`** — legibility floor so the farthest ship is a clear small shape, not sub-pixel.
- **`MAX_ANGLE`** — cap (fraction of FOV) so a near ship can't swallow the frame.

Monotonic in both args: longer ship → larger; nearer ship → larger (for any `SIZE_CONSTANCY < 1`).

### Rule 2 — Depth / spread (vertical placement only)

The fan-out already built, now decoupled from size. Chooses a **rendered distance** `d'` along the
true bearing ray; the smaller `d'`, the larger the depression angle, the lower in frame:

```
renderedDistanceKm(trueKm) = trueKm * (1 - DEPTH_SPREAD * nearness(trueKm, NEAR_KM, FAR_KM))
```

- **`DEPTH_SPREAD` ∈ [0,1)** — the "Spread" slider; replaces `EXAGGERATION`. `0` = ships sit at
  true depression (piled at horizon); higher = nearer ships pulled lower, fanning the fleet down
  the foreground. No size side-effect now (size is Rule 1).
- `nearness` (already in `geometry.js`) ramps 1→0 from `NEAR_KM` out to `FAR_KM`.
- The ship stays grounded on the water at `d'` along its true bearing, so reflection + wake hold.

The mesh world scale is then solved so the ship subtends `apparentAngle` at `d'`:
`scale = apparentAngle * d'(metres) / meshLengthMetres` (small-angle). Bearing and target size are
both hit exactly regardless of `d'`.

### Rule 3 — Haze (perceptual, with a floor)

Ships get an **explicit per-ship haze** from their TRUE distance, independent of the scene's
`FogExp2` (which still does sky/sea/Venezuela atmosphere). The eye keeps a shape legible, so:

```
shipClarity(trueKm) = 1 - HAZE_STRENGTH * (1 - clarityFloor) * (trueKm / FAR_KM)
```

(or an equivalent gentle curve; exact shape tuned by eye). `clarity` 1 = crisp, and never falls
below `clarityFloor`. Applied by lerping the ship's rendered colour toward the horizon/haze tint
by `(1 - clarity)` and/or easing opacity — so distance still softens a ship (wanted depth cue) but
never veils it. **`HAZE_STRENGTH`** is the "Haze" slider; `0` = ships fully crisp to the cull,
`1` ≈ near-physical fade.

Because ship haze now keys off true distance (not `d'`), ship materials opt out of the scene
`FogExp2` (`fog: false`) and use this explicit haze instead; everything else still fogs normally.

## Architecture & components

- **`public/js/perception.js`** — NEW, pure (no `three` import, unit-tested under node). The three
  rules as small functions: `apparentAngle(lengthM, trueKm, gain, constancy, minA, maxA)`,
  `renderedDistanceKm(trueKm, spread, nearKm, farKm)`, `shipClarity(trueKm, farKm, strength,
  floor)`. May re-use `nearness` from `geometry.js`.
- **`public/js/config.js`** — add `SIZE_GAIN`, `SIZE_CONSTANCY`, `MIN_ANGLE`, `MAX_ANGLE`,
  `DEPTH_SPREAD` (rename of/replacing `EXAGGERATION`), `HAZE_STRENGTH`, `HAZE_FLOOR`. Keep
  `NEAR_KM`, `FAR_KM`. Document units + slider ranges.
- **`public/js/world.js`** — `updateShips` calls `perception.js`: place at `d'` along true bearing,
  set mesh scale from `apparentAngle`, apply per-ship haze tint; ship materials `fog: false`.
  Hull-down still uses true distance. Reads the live (slider-updated) knob values each frame.
- **`public/js/ui.js`** (+ panel HTML/CSS) — a collapsible **"Calibration"** group with three
  sliders (Size / Spread / Haze) initialized from the config constants, writing to the live knob
  object `world` reads. Mirrors the existing sightline-slider pattern. Removable later.
- **Live knob plumbing** — a single small `controls`-style object (or extend the existing one in
  `main.js`) holding `{ sizeGain, depthSpread, hazeStrength }`, defaulted from config, overridden
  by sliders, passed into `updateShips` via the per-frame `env`.

### Data flow (per frame)

`main.js` builds `env` (already has ambient/deckHeight) + the live calibration knobs → `world.updateShips(ships, env)` → per ship: `renderedDistanceKm` → place along true bearing; `apparentAngle` → mesh scale; `shipClarity` → haze tint. Sliders mutate the knob object; no reload needed.

## Testing

Pure, unit-testable (`node --test`, TDD) in `perception.test.js`:
- `apparentAngle`: monotonic ↑ in length, monotonic ↑ as distance ↓ (for constancy < 1); at
  `SIZE_CONSTANCY = 0` reduces to `∝ length/distance` (optics); at `1` is distance-independent;
  respects `MIN_ANGLE` floor and `MAX_ANGLE` cap.
- `renderedDistanceKm`: equals true distance when `DEPTH_SPREAD = 0`; pulls nearer ships in more;
  never exceeds true distance; `> 0`.
- `shipClarity`: 1 at zero distance, decreases with distance, never below `HAZE_FLOOR`, equals 1
  everywhere when `HAZE_STRENGTH = 0`.

Visual-only (judge in the real app, host-side `npm start`): the felt size, spread, and crispness;
the slider tuning loop; that bearing/left-right placement is unchanged.

## Acceptance

- Ships read at a believable, glanceable size in the faithful full-width view — no zoom needed —
  with bigger/nearer ships still clearly larger.
- The fleet fans down the water (foreground populated), bearing/left-right placement unchanged
  from true.
- Ships stay crisp, recognizable shapes out to the cull; distance still softens them gently.
- Three working "Calibration" sliders (Size/Spread/Haze) retune the look live against the real
  bay; their values can be read off and baked into `config.js`.
- Pure rules covered by green tests; hull-down/reflection/wake/lighting unchanged.

## Out of scope (separate specs / later)

- **Look-toward zoom** — step 2 of the agreed plan; its own spec, tuned to feel continuous with
  this static look.
- **Full sweep / cylindrical projection** distortion fix — separate debugging spec (already
  queued).
- On-screen ship name/flag labels and nav lights — the user-decreed final milestone.
