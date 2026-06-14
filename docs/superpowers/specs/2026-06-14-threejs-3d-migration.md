# BB45 — Three.js 3D migration + two-view system

Date: 2026-06-14
Status: implemented
Implemented on Three.js r160 (vendored). Cylindrical render-to-target path shipped for the wide view; the ~110° perspective fallback was NOT needed (pending the user's on-device performance check).

## Goal

Make the whole scene genuinely 3D and as real as possible: a perspective camera at
the deck looking out over a real reflective sea, real sky and sun, ships sitting in
the water and fading into atmospheric haze at their true range. Replace the 2D canvas
painter with a Three.js render layer while keeping every non-render module intact.

Alongside the render rewrite, add a **two-view system**: a narrow primary view and the
existing wide sweep as a secondary view.

## Superseded decision (deliberate, not drift)

The original BB45 design committed to "vanilla JS + Canvas, no framework, no bundler,
near-zero dependencies." The realism goal intentionally supersedes the *Canvas* part of
that stance: we adopt **Three.js** as the render library. We preserve the spirit of the
rest — **no bundler, no build step, native ES modules** — by vendoring Three.js locally
and importing it via a relative path. Three.js is the project's second runtime dependency
(after `ws` for the relay) and the only frontend one.

## Locked decisions

1. **Projection** — perspective camera for the `main` (71°) view; a cylindrical
   projection for the `max` (156°) view only. A flat perspective camera smears badly
   past ~100°, and capping the FOV would discard ~56° of the real measured sweep,
   breaking the "faithful mirror of what the eye sees" premise. Capping `max` to
   ~100–110° is a **fallback only**, used solely if the cylindrical path proves too
   costly this iteration — and it must be flagged to the user, never applied silently.

2. **Delivery** — vendor Three.js (and any addons) locally under
   `public/vendor/three/`, committed to git (it must NOT live under the gitignored
   `node_modules/`). Import via relative path. The app must work fully offline / over
   flaky island connections / via `file://`. The version is pinned and recorded.

3. **Ships** — all ships are billboarded silhouette sprites this migration. The visible
   range (waterline horizon ~20 km, ships culled ~44 km) means essentially every ship
   is distant enough that a flat silhouette is the physically honest depiction, not a
   shortcut; a mesh would render as a few pixels. Sprites also contain the blast radius
   of the render-layer migration. Near-ship 3D meshes are a separate later milestone,
   evaluated against this sprite baseline.

## Two-view system

Replace the single `DECK` constant in `config.js` with a `VIEWS` map and a default
selector. Keep all view numbers as easily-editable constants — the edges were measured
at night off nearby landmarks and are provisional pending a morning fine-tune.

```js
export const VIEWS = {
  main: { label: "Main",       lat: 12.135972, lon: -68.989167, height: 32,
          viewBearing: 219.5, fov: 71 },   // edges 184° → 255°; horizon ≈ 3.57·√32 ≈ 20.2 km
  max:  { label: "Full sweep", lat: 12.135778, lon: -68.989280, height: 30.5,
          viewBearing: 223,   fov: 156 },  // edges 145° → 301°; horizon ≈ 19.7 km
};
export const DEFAULT_VIEW = "main";
```

- Everything that reads `DECK.lat/lon/height/viewBearing/fov` reads the **active view**
  instead. Centralize the active-view state so switching updates the whole scene (sky,
  sea, ships, horizon, compass strip, sightline).
- A small UI toggle switches `main ↔ max`. Same scene and geometry; only the viewpoint
  (and projection path) changes.
- **Venezuela landfall** (`bearing 249°, 110 km, peak 830 m`) is unchanged and must
  stay in frame in **both** views — in `main` it is +29.5° of the 219.5° center, just
  inside the 35.5° half-FOV near the right edge. A test guards against the refactor
  accidentally culling it.

## Architecture: a 3D world under a 2D overlay

Two stacked layers in the DOM:

- **WebGL canvas (the world):** sky, sun, sea, ships, the Venezuela ridge — placed once
  in a single local ENU world and rendered by Three.js.
- **2D overlay canvas + HTML panels (HUD / foreground):** the travertine deck,
  frameless-glass tint, corner palms, the compass strip, the weather/sightline panels,
  and ship tooltips. Drawn on a transparent 2D canvas layered above the WebGL one
  (higher `z-index`). This reuses `drawDeck` / `drawPalms` / `drawCompass` and all of
  `ui.js` nearly untouched — the deck is foreground framing, not part of the 3D scene.

### Coordinate system

Local **ENU** (East-North-Up) in metres, one fixed origin. Each view's camera sits at
its own `(east, height, −north)` offset from the origin (Three.js is Y-up; map East→+X,
Up→+Y, North→−Z so camera yaw equals compass bearing). A new pure `enu(lat, lon)` helper
is derived from the existing haversine/bearing math and unit-tested under Node. Ships are
placed by `enu(ship.lat, ship.lon)` relative to the origin.

### Hull-down stays explicit

A flat infinite sea plane puts the horizon at eye level but does **not** model Earth
curvature, so ships would never go hull-down on their own. `hullDownState()` from
`geometry.js` keeps driving how far each ship sprite sinks / clips below the horizon,
preserving the honest "superstructure-only at distance" behavior.

### Atmosphere

`FogExp2` with density `= 3.912 / sightlineKm` (Koschmieder, the visual range at which
contrast falls to ~2%), applied in world space so it survives both projection paths.
This single fog is **both** the ship haze-out and the Venezuela ridge fade, replacing
the old `hazeAlpha` and the manual landfall opacity ramp.

## The two projection paths

The world is built once. A small `Projection` interface owns how that world reaches the
screen and how a world point maps back to a screen pixel (so the overlay — tooltips,
hover hit-rects, compass ticks — stays aligned in either mode):

```
Projection {
  resize(w, h)
  render(renderer, scene)                  // draw the world to the WebGL canvas
  project(worldPosENU) -> { x, y, visible } // world -> screen px, for overlay + hover
}
```

- **`PerspectiveProjection` (main, 71°)** — wraps a `PerspectiveCamera` at the active
  viewpoint's ENU position, yawed to `viewBearing`, pitch ≈ 0. The measured FOV is
  horizontal, so convert to Three's vertical FOV via the aspect ratio on every resize.
  `render` = `renderer.render(scene, camera)`; `project` = standard camera projection.

- **`CylindricalProjection` (max, 156°)** — renders the scene to an off-screen target,
  then a fullscreen composite samples it with cylindrical coordinates: azimuth (relative
  to `viewBearing`) maps **linearly** to screen-x across the full 156°, elevation maps to
  screen-y. Result: straight verticals, horizon as a gentle arc, full measured sweep,
  no edge-stretch. `project` uses the same azimuth/elevation math so the compass strip
  and ship tooltips land exactly where ships are drawn.

### Cylindrical implementation: render-to-target, not vertex remap

A vertex-shader cylindrical remap was considered (and preferred *if simpler*), but for
this scene it is **not** simpler and is rejected: the sky and sea are Three's own
custom-shader objects (`Sky`, `Water`), so a global vertex remap would require patching
third-party shaders **and** finely tessellating the large flat polygons (or their
straight edges render as chords, not arcs).

Instead the `max` view uses a **render-to-target → cylindrical composite**: render the
scene into a partial cubemap covering the 156° azimuth span plus the horizon band, then
one fullscreen pass samples it by cylindrical coordinates. This treats the scene as a
black box — all materials, fog, and reflections work unmodified — at the cost of one
extra render pass, which this light scene affords. If that pass proves too costly on the
target hardware, the **flagged fallback** is to cap `max` at ~110° (clean in a single
perspective camera) — reported to the user, never silent.

## Ships: one placement seam

`placeShip(world, ship, env)` owns world position, scale (real length → world units),
and fog/haze fade; the **visual is swappable** (sprite now, mesh later) behind it. No
sprite-specific assumptions leak into geometry, projection, or fog code.

- Per-type silhouettes (container / tanker / bulk / cruise / coaster / yacht / fishing)
  are rendered to a `CanvasTexture` reusing the refined art from commit `9c2567e`, then
  placed as billboard sprites at true ENU position, scaled to real length.
- Course-based bow mirroring is kept.
- The hover hit-rect comes from `projection.project(ship.worldPos)` plus apparent size,
  so hover/tooltip work in both views.
- Verified to render at correct bearing/distance and fade into `FogExp2` at the right
  range in **both** the 71° perspective and 156° cylindrical views before the cylindrical
  commit closes.

## Sky, sun, water, night

- **Sky + sun:** Three's `Sky` (Preetham scattering) with the sun placed from the real
  azimuth/elevation already computed in `sky.js`; a directional light from the same
  direction. The existing `SKY` keyframes drive exposure/ambient.
- **Water:** Three's `Water` addon (reflective, normal-mapped ripples, sun specular),
  wave direction/strength driven by the real wind from `weather.js`. Reflection cost is
  a perf watch item; reflect sky/sun reliably, ships only if affordable.
- **Night:** `Sky` is a daytime model, so the night side uses a custom starfield (points)
  + a real-phase moon sprite (reusing `sky.js` `moonPhase`), crossfaded with the daytime
  sky by sun elevation.

## What stays / what changes

**Stays (reused as-is or nearly):** `geometry.js` (+ new `enu()`), `sky.js`,
`weather.js`, `sim.js`, `store.js`, `relay-client.js`, the relay, `ui.js` panels /
tooltip / sticky-hover / controls, the deck/palm/compass painters (moved to the overlay
canvas), the AIS + weather data flow, the two-view config.

**Changes (rewritten for 3D):** `scene.js` (2D sky/sea/clouds/stars/moon draws → Three
objects), `ships.js` (canvas silhouettes → billboard sprite textures), the `main.js`
frame loop (`ctx.draw…` → Three render + scene updates), `index.html` (WebGL canvas +
vendored import; deck canvas becomes the overlay), `config.js` (`DECK` → `VIEWS` /
`DEFAULT_VIEW`; `EXAGGERATION` retired — a real camera produces the near-low/far-high
drop for free). New: `world.js` (Three scene/camera/water/sky setup) and the projection
modules.

## Build order — small commits (each leaves a runnable app)

1. **Two-view config + UI toggle** on the *existing canvas* (`VIEWS` / `DEFAULT_VIEW`,
   active-view plumbing, switch button, landfall-in-frame tests). Pure data/config
   refactor on a known-good renderer — de-risks the rest.
2. **Vendor Three.js** (+ `Sky`, `Water` addons) under `public/vendor/three/`, version
   pinned + README; add the WebGL canvas under the overlay; smoke-test a clear frame.
3. **ENU + world scaffold** — `enu()` (+tests), `world.js`, the `Projection` interface,
   `PerspectiveProjection`, water plane + camera for `main`.
4. **Sky + sun + fog** (main) — sky/sun from `sky.js` az/el, `FogExp2` from sightline.
5. **Ships** (main) — `placeShip()` + sprites, hull-down, fog haze, `project()` wired to
   hover/tooltip/compass.
6. **Foreground overlay** — deck/palms/compass move to the top transparent canvas.
7. **Cylindrical `max` path** — `CylindricalProjection` (RTT → cylindrical composite) +
   matching `project()`; verify full sweep, arc horizon, ships + fog, landfall in frame.
   Flag if falling back to ~110°.
8. **Night + polish** — stars/moon night-side crossfade; water driven by real wind.
9. **Spec + cleanup** — finalize this spec, delete dead 2D scene/ship code, confirm the
   vendor README records the pinned version.

## Verification reality

The WebGL render layer can't unit-test under Node (no GL context), and the sandbox
localhost is unreachable from the user's browser. Visual confirmation stays the user's
eyeball via `npm start` on the Windows host (as with the dynamic-sky work). The *logic*
— `enu()`, active-view selection, fog-from-sightline, cylindrical `project()` math,
landfall-in-frame — stays under Node tests.

## Out of scope (this migration)

3D hull meshes for near ships; dynamic sea via the Open-Meteo Marine API (wave height /
period — a later enhancement to the wind-driven water); m5 ship identity (AIS type →
silhouette, MMSI MID → flag); the final glanceable on-ship info pass.
