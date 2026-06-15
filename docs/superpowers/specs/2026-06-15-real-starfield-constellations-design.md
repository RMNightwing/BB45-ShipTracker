# Real starfield + constellations — astronomically accurate night sky

Date: 2026-06-15
Status: design approved (brainstorm), ready to plan

## Why

The current starfield is a **Fibonacci/golden-angle spiral** of 2600 identical points
(`world.js`): perfectly even spacing, uniform size, uniform colour. Even spacing + identical
dots reads as a lattice — a test viewer literally mistook it for a grid. Real skies are random,
with a wide brightness range (a few blazing stars, thousands faint) and subtle colour.

The fix, chosen in the brainstorm, is to go **astronomically real** — consistent with the app's
"what I'd actually see from my deck" identity and the existing real sun/moon (`sky.js`). A real
magnitude-6 catalog (~5000 stars) IS the naked-eye sky: real random positions, real brightness,
real colour. That kills the grid look *and* lets us draw true constellations.

## Locked decisions (from the brainstorm)

- **Astronomically accurate**, not decorative: stars placed at their true alt/az for Blue Bay's
  latitude/longitude and the current date/time.
- **Real catalog data, user-provided.** The sandbox can't download; the user drops two small
  BSD-licensed files from the `d3-celestial` project into `public/data/`:
  - `stars.6.json` — stars to mag 6 (~5000), GeoJSON with RA/Dec + `mag` + `bv` (B–V colour).
  - `constellations.lines.json` — constellation line paths as RA/Dec vertices.
  Sources (for the README): `https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json`
  and `.../constellations.lines.json`.
- **Constellation lines with a toggle** — drawn faint; a toolbar button `Lines` + key `l` show/hide.
- **Sky rotates with real time** — recomputed from the clock like sun/moon (~15°/hr).
- **No separate random layer** when the catalog loads — the mag-6 catalog is the realistic field.
  A random faint field is only a *fallback* if the data files are missing (so it's never a grid).

## The design

### 1. Coordinate math — `public/js/stars.js` (pure, unit-tested)

Mirrors `sky.js` conventions (hour angle `H = LST − RA`, standard alt/az). Degrees in/out.

- `siderealTimeDeg(date, lonDeg)` → local sidereal time (deg). Reuses the same J2000-day basis as
  `sky.js`'s `siderealTime`.
- `raDecToAltAz(raDeg, decDeg, latDeg, lstDeg)` → `{ altDeg, azDeg }`:
  - `H = lst − ra`
  - `alt = asin(sin dec·sin lat + cos dec·cos lat·cos H)`
  - `az = atan2(sin H, cos H·sin lat − tan dec·cos lat)` then normalised to a compass bearing.
- `bvToColor(bv)` → `[r,g,b]` 0..1: B–V index → star colour (blue-white ~ −0.3, white ~ 0.3,
  yellow ~ 0.6, orange/red ~ 1.5). A small piecewise/temperature approximation.
- `magToSize(mag, maxPx)` → px: brighter (lower mag) → larger; faint (mag ≈ 6) → ~1 px floor.

These are pure (no `three`) and tested under `node --test` with deterministic cases (e.g. a star
at Dec +90° sits at alt = observer latitude due north at any time; a star on the meridian has
az 0/180 and alt = 90 − |lat − dec|; bv/mag monotonicity and clamps).

### 2. Star field + lines — `public/js/star-field.js` (browser)

`createStarField(scene)` returns `{ update, setLinesVisible, setNightAlpha, ready }`.

- **Load** `data/stars.6.json` and `data/constellations.lines.json` via `fetch`. Parse the GeoJSON:
  each star → `{ raDeg, decDeg, mag, bv }`; each constellation line → a polyline of `[raDeg,decDeg]`
  vertices. On load failure, log once and build a **random faint fallback field** (uniform-random
  on the sphere, varied size/alpha) so the grid never returns.
- **Stars** = one `THREE.Points` with a small `ShaderMaterial` carrying per-vertex `size` (from
  `magToSize`) and `color` (from `bvToColor`), plus a uniform `uAlpha` for the night fade. (Per-
  star size needs `gl_PointSize` from an attribute — `PointsMaterial` can't vary size per point.)
- **Lines** = one `THREE.LineSegments` (faint, `fog:false`), its own `uAlpha`; visibility toggled.
- **`update(date)`**: compute `lstDeg` once, then for every star/line vertex compute alt/az and
  the ENU/THREE direction `(cos alt·sin az, sin alt, −cos alt·cos az)·R`. Stars below the horizon
  (`alt < 0`) get size 0 (hidden) so nothing shows under the sea. Throttle to recompute only when
  the clock has advanced enough to matter (≈ every few seconds) — the sky moves 0.25°/min.
- **`setNightAlpha(a)`**: drives both `uAlpha`s (stars + lines) so the field fades in at dusk
  exactly as the current starfield does (from `env.starAlpha`).

### 3. world.js integration

Replace the Fibonacci starfield block with `const starField = createStarField(scene)`. In
`updateEnv`/render: `starField.setNightAlpha(env.starAlpha)` and `starField.update(now)` (the
`now` date already built each frame in `main.js`). Expose `setConstellationLines(bool)` on the
world object, delegating to `starField.setLinesVisible`.

### 4. Lines toggle (UI)

A 4th toolbar button `Lines` (key `l`), wired like the existing panel toggles but calling
`world.setConstellationLines(bool)` instead of showing a panel. Default **on** (faint) so the
constellations are visible; toggle off for a pure naked-eye sky.

### 5. Data folder

`public/data/` with a `README.md` naming the two files, their `d3-celestial` source URLs, and the
license, so it's reproducible. The JSON files themselves are user-dropped (and may be gitignored
or committed — user's choice; default: commit them so the app is self-contained).

## Files touched

- `public/js/stars.js` — NEW (pure math + tests).
- `public/js/star-field.js` — NEW (loader + Points/LineSegments + update/rotate/toggle).
- `public/js/world.js` — replace Fibonacci stars with `createStarField`; wire update + night alpha
  + `setConstellationLines`.
- `public/js/main.js` — pass `now` to the star update if not already; wire the `Lines` toggle.
- `public/js/ui.js` — extend the toolbar/keys with the `Lines` toggle.
- `public/index.html` — `Lines` button in `#toggles`.
- `public/data/README.md` — NEW (names files + sources + license).

## Testing

Pure, `node --test` (TDD) in `stars.test.js`:
- `raDecToAltAz`: Dec +90 → alt ≈ lat, az ≈ 0; meridian star (H=0) → alt = 90 − |lat − dec|,
  az ∈ {0,180}; a star below the horizon returns alt < 0.
- `siderealTimeDeg`: matches a known GMST value for a reference UTC within tolerance; monotonic in
  time and longitude.
- `bvToColor`: blue end for low bv, red end for high bv, clamped; `magToSize`: monotonic decreasing
  in mag, floored.

Visual-only (host `npm start`, at night): the field looks random/varied (no grid), constellations
sit correctly (Orion, Scorpius, Crux low to the south for 12°N), lines toggle via `l`, and the sky
fades in at dusk and wheels slowly through the night.

## Acceptance

- The night sky reads as a real, random, varied starfield — not a grid.
- Recognizable constellations appear in their true positions for Blue Bay and the current time.
- `Lines` toggle (button + `l`) shows/hides constellation lines; default on, faint.
- Stars fade in/out with dusk/dawn (unchanged behaviour) and wheel with the real clock.
- If the data files are absent, a random fallback field renders (never a grid); pure math tests green.

## Out of scope (later / separate)

- Constellation/star **name labels** on screen.
- Planets, Milky Way band, meteor showers, twinkle.
- The paused **3D ship models** work and the **haze punch-up** tuning remain their own threads.
