# BB45 — Dynamic Sky design

A living sky for the Blue Bay deck: the sun, sky color, stars, moon, and clouds
all follow the real clock, the real sun position, and the real wind — so the
view mirrors what you'd actually see outside, at whatever time you look.

Scope: **sky only** this milestone. Waves (Open-Meteo Marine API + a sea-motion
rewrite) are a separate follow-on milestone. Rain/fog from weather codes, true
star constellations, and true lunar position are explicitly out of scope.

## Decisions (from brainstorming)

- **Time basis:** real local time. The browser reads `new Date()` each frame;
  sun/moon are computed from that absolute instant + the DECK coordinates, so the
  timezone is handled by geography (correct as long as the PC clock is correct).
- **Sun placement:** true astronomical azimuth + elevation. Horizontal is exact
  (azimuth → x via the existing `projectX`); vertical is the project's usual
  stylized elevation → y map. The sun is on-screen only when its azimuth falls in
  the 145°–301° view and it is at/above the horizon — mornings it is genuinely
  off to the left, afternoons it tracks toward a real WNW sunset on the right.
- **Night:** a decorative twinkling starfield (not real constellations) plus a
  moon drawn at tonight's **real phase**, riding a simple stylized arc.
- **No new network call:** sun/moon are pure math; clouds reuse the wind and
  cloud-cover already fetched from Open-Meteo.

## Architecture

### `public/js/sky.js` — pure, unit-tested (no DOM, no drawing)

- `sunPosition(date, lat, lon)` → `{ azimuth, elevation }` in degrees. Standard
  solar-position algorithm (Julian date → solar coordinates → local az/el).
- `moonPhase(date)` → `{ fraction, waxing }` where `fraction` is illuminated
  fraction 0..1 and `waxing` is a boolean (which limb is lit). Synodic-month calc.
- `skyState(elevationDeg)` → an interpolated environment palette:
  `{ skyTop, skyBottom, seaTop, seaBottom, horizon, sunTint, ambient, starAlpha }`.
  Interpolated between elevation keyframes (below).
- `projectCelestial(azimuth, elevation, viewBearing, fov, W, H, horizonY)` →
  `{ x, y, visible }`. `x` from azimuth via `projectX`; `y` from the stylized
  elevation map; `visible:false` when below the horizon or outside the view arc.

All four take their inputs explicitly (date passed in, not read from a clock) so
they unit-test deterministically under `node --test`.

### `public/js/scene.js` — drawing, consumes an `env` object

- `drawSky(ctx, W, H, t, env)` — gradient from the palette fields on `env`
  (`env.skyTop`/`env.skyBottom`, spread in by `main.js`); sun glow drawn at
  `env.sun.{x,y}` tinted by `env.sunTint`, only when `env.sun.visible`.
- `drawSea(ctx, W, H, t, env)` — sea gradient darkened by `env.ambient`;
  sun-glitter only when the sun is up and in view, descending from `env.sun.x`.
- `drawClouds(ctx, W, H, t, env)` — drift vector + density from `env.wind` and
  `env.cloudPct`; cloud tint from the palette.
- `drawStars(ctx, W, H, t, env)` — ~120 stars placed once at module load, fixed
  positions above the horizon, twinkling via `sin(t)`, brighter near zenith,
  whole field scaled by `env.starAlpha`.
- `drawMoon(ctx, W, H, t, env)` — lit disc + shadow terminator from
  `env.moon.{fraction,waxing}` at `env.moon.{x,y}`, faded by `env.starAlpha`.

### `public/js/main.js` — per-frame assembly

Each frame: `const now = new Date()`; compute `sun = sunPosition(now, DECK.lat,
DECK.lon)`, `moon = moonPhase(now)`, `state = skyState(sun.elevation)`; project
the sun and a stylized moon arc; build
`env = { ...state, sun:{...}, moon:{...}, wind:{dir,kn}, cloudPct }` from `state`
plus `wx.windDir / wx.windKn / wx.cloud` (refreshed by the existing 10-min weather
loop); pass `env` to the scene draw calls.

### `public/js/config.js` — palette keyframes

A `SKY` keyframe table indexed by sun elevation, each entry the full palette
object `skyState` interpolates between.

## The palette keyframes (sun elevation → look)

| Elevation        | Phase            | Feel                                   | starAlpha |
|------------------|------------------|----------------------------------------|-----------|
| `> +8°`          | day              | today's blues                          | 0         |
| `+8° → 0°`       | golden hour      | warm peach/gold, horizon warms         | 0         |
| `0° → -6°`       | civil twilight   | orange → indigo                        | 0 → ~0.4  |
| `-6° → -12°`     | nautical twilight| deep indigo → near dark                | ~0.4 → 1  |
| `< -12°`         | night            | dark navy, full stars                  | 1         |

`skyState` linearly interpolates each channel between the two bracketing
keyframes by elevation, so transitions are smooth. Cloud-cover % gently mutes
saturation and raises cloud density.

## Vertical (elevation → y) map

Stylized, matching the app's "horizontal exact, vertical stylized" rule:
elevation `0°` → `horizonY`; elevation rises toward the top of the canvas, capped
near `~y=0` by roughly `45°`. Smooth (e.g. a clamped linear or eased map). The
exact curve is tunable by eye; the contract is monotonic and `0° == horizonY`.

## Clouds: wind → motion

- **Direction/speed:** project the wind vector onto the view. A crosswind
  (blowing across the bearing) gives fast horizontal drift; a head/tailwind
  (toward/away) gives slow drift. Sign of drift follows wind direction.
- **Density/opacity:** scale cloud count and alpha with `cloudPct` — a clear sky
  is a few wisps, overcast is many and denser.
- **Tint:** clouds take the current palette (white by day, grey-blue at dusk,
  dark at night).

## Testing

`public/js/sky.test.js` (Node, pure functions only):
- `sunPosition` matches known ephemeris for a fixed date/location within ~1°.
- `moonPhase` returns ~full near a known full-moon date and ~new near a known new
  moon; `waxing` flips correctly across a known new moon.
- `skyState` returns the day palette at high elevation and the night palette at
  low elevation, and interpolates monotonically (e.g. `starAlpha` rises as the sun
  sets).
- `projectCelestial` reports `visible:false` below the horizon and outside the
  view arc, and places a known azimuth at the expected x.

Drawing (`scene.js`) and the per-frame wiring (`main.js`) are runtime glue,
verified by eye in the browser, not unit-tested — consistent with the rest of the
project.

## Out of scope (future milestones)

- **Waves** — Open-Meteo Marine API (wave height/direction/period) + sea-motion
  rewrite. The next milestone.
- Rain / fog / overcast effects from `weather_code` (this milestone uses
  `cloud_cover` only).
- True star constellations and true lunar position.
