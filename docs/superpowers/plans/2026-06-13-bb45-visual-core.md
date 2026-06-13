# BB45 Visual Core (Milestones 1–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the BB45 repo and build the full first-person horizon ship-watcher view — scene + physics-honest geometry + live weather + simulated ships — served locally, ready to open in a browser.

**Architecture:** Vanilla JS + HTML Canvas, native ES modules (no bundler). Pure-math/logic modules (`geometry`, `sim`, `weather`, ship hit-testing) are unit-tested with Node's built-in test runner. Visual modules (`scene`, `ships` drawing, `ui`) are concrete first implementations verified by eye in the browser and tuned live. A tiny zero-dependency Node static server serves `public/`.

**Tech Stack:** Node 20+ (built-in `node --test`, `node:assert`, `node:http`), HTML5 Canvas 2D, ES modules, Open-Meteo HTTP APIs. Zero runtime dependencies for this milestone.

**Stop condition:** After Task 12, the app runs via `npm start` with `USE_SIM=true` and live weather. STOP for browser review before building the AIS relay (milestone 3).

**Conventions:** 2-space indent, minimal comments, metric units, `camelCase`. Modules only *define* functions at import time (no DOM access at module top level) so logic modules import cleanly under Node. Only `main.js` touches `document`/`window`, and it is never imported by tests.

---

## File structure

```
public/
  index.html              canvas + panel markup; <script type="module" src="js/main.js">
  js/
    config.js             DECK constants, EXAGGERATION, USE_SIM, fov, bbox, palette, derived
    geometry.js           toRad/toDeg, normalizeSigned, bearingTo, haversineKm, horizonKm,
                          shipHorizonKm, projectX, apparentWidthPx, hullDownState, nearness
    geometry.test.js      unit tests (node --test)
    sim.js                makeFleet, advanceShip, needsRecycle, recycle, stepFleet
    sim.test.js           unit tests
    weather.js            humidityFactor, sightlineKm, venezuelaVerdict, fetchWeather
    weather.test.js       unit tests
    ships.js              shipSilhouette draw fns, drawShip, shipAtPoint (hit-test)
    ships.test.js         unit tests (shipAtPoint only)
    scene.js              sky/sea/sun/glitter/clouds/curved horizon, deck, palms, compass strip
    ui.js                 weather panel, sightline slider, drift + live-wx toggles, tooltip
    main.js               wiring + requestAnimationFrame loop + hover handling
server/
  static.js               zero-dep static server for public/
  static.test.js          unit test (serves a file, sets MIME, blocks traversal)
  .env                    empty (gitignored)
  .env.example            AISSTREAM_API_KEY=
package.json              type:module, scripts: start, test
CLAUDE.md                 project brief + how to run
.gitignore
```

---

## Task 1: Scaffold the repo + git init

**Files:**
- Delete: `src/Main.java` (and the now-empty `src/` dir)
- Create: `CLAUDE.md`, `package.json`, `.gitignore`, `server/.env`, `server/.env.example`
- Create dirs: `public/js`, `server`

- [ ] **Step 1: Remove the Java starter**

Run:
```bash
rm -f src/Main.java && rmdir src 2>/dev/null; echo done
```
Expected: `done` (the `rmdir` quietly no-ops if `src` is not empty).

- [ ] **Step 2: Create the directory skeleton**

Run:
```bash
mkdir -p public/js server
```

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "bb45",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "First-person horizon ship-watcher for a deck in Blue Bay, Curacao",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node server/static.js",
    "test": "node --test"
  }
}
```

- [ ] **Step 4: Write `.gitignore`** (replace the existing IntelliJ one entirely)

```gitignore
node_modules/
server/.env
.idea/
mockups/
.superpowers/
.DS_Store
```

- [ ] **Step 5: Write `server/.env.example`**

```
AISSTREAM_API_KEY=
```

- [ ] **Step 6: Create empty `server/.env`**

Run:
```bash
: > server/.env
```

- [ ] **Step 7: Write `CLAUDE.md`**

````markdown
# BB45 — Blue Bay ship watcher

A first-person "what I'd see looking out from my deck" ship watcher for a house in
Blue Bay, Curaçao. NOT a top-down map — ships are drawn against the real horizon at
their true bearing and apparent size, framed by the deck edge, with a weather-driven
visibility edge. Personal project, one house. Simple and fun.

Full design + rationale: `docs/superpowers/specs/2026-06-13-bb45-design.md`.

## Stack & conventions

- Vanilla JS + HTML Canvas frontend. Native ES modules, no framework, no bundler.
- Node 20+ and the `ws` package for the AIS relay (milestone 3+ only).
- Units metric (km, m, knots, °C). Timezone America/Curaçao (AST).
- No secrets in the frontend. No localStorage. Near-zero dependencies.
- 2-space indent, minimal comments, camelCase. Modules only define functions at
  import time (no DOM at top level) so logic modules unit-test under Node.

## Run

```bash
npm start          # serves public/ at http://localhost:5173
npm test           # runs node --test over the *.test.js files
```

`public/js/config.js` holds `USE_SIM` (simulated fleet, default true until the relay
exists) and the DECK constants (the source of truth for the whole view).

## The geometry (drives everything)

- bearing → horizontal position (exact); distance → apparent size (exact, capped).
- Vertical position is the only stylized axis: a gentle `EXAGGERATION` nudge so
  nearer ships sit lower for legibility. Hull-down onset stays physically exact.
- `horizonKm(h) = 3.57·√h`. From a 28 m deck the sea horizon is ≈18.9 km; a ship's
  superstructure stays visible to ≈38 km, then it is culled.
- The Venezuela ridge (70 km, ~900 m peaks) is gated by an aerosol-derived
  long-range sightline, NOT the API `visibility` field (which caps ~24 km).

## Milestones

1. Scaffold + CLAUDE.md + git. ← done
2. Visual core: scene + geometry + live weather + simulated ships (USE_SIM=true).
3. Relay: server/relay.js → aisstream, key from .env, reconnect + resubscribe.
4. Frontend wiring: connect to relay, feed ships[] from live data, USE_SIM off.
5. Ship identity: AIS type-code → silhouette; MMSI MID → country flag.
6. Calibration: replace DECK estimates with measured values.

## Out of scope

Auth, accounts, databases, deployment. Local-only.
````

- [ ] **Step 8: git init and first commit**

Run:
```bash
git init -b main
git add -A
git status
```
Expected: staged files include `CLAUDE.md`, `package.json`, `.gitignore`, `server/.env.example`, `docs/...`, but NOT `server/.env`, `.idea/`, `mockups/`, `.superpowers/`.

- [ ] **Step 9: Verify ignores are working, then commit**

Run:
```bash
git check-ignore -v server/.env .idea mockups .superpowers && \
git commit -m "chore: scaffold BB45 repo, CLAUDE.md, and design spec"
git log --oneline
```
Expected: each ignored path prints a matching rule; commit succeeds; `git log` shows one commit.

---

## Task 2: `config.js` — constants (source of truth)

**Files:**
- Create: `public/js/config.js`

No test (pure data + trivially-derived constants). It is exercised by every later task.

- [ ] **Step 1: Write `public/js/config.js`**

```js
// The deck — source of truth for the whole view. ESTIMATES until calibration (m6).
export const DECK = {
  lat: 12.1349,
  lon: -68.9853,
  height: 28,        // m above sea level
  viewBearing: 202,  // compass dir the deck faces = view centre
  fov: 108           // degrees, edge to edge
}

// Venezuela landfall (the visibility prize).
export const LANDFALL = { bearing: 196, distanceKm: 70, peakM: 900 }

// Toggle the simulated fleet. Stays true until the AIS relay lands (m4).
export const USE_SIM = true

// Vertical-spread stylisation. 0 = physically literal (flat row on horizon),
// 1 = dramatic. Bearing and apparent size are NEVER affected by this.
export const EXAGGERATION = 0.3

// Render/recycle envelope (km).
export const NEAR_KM = 4
export const FAR_KM = 55

// Assumed average ship superstructure height (m) for the hull-down horizon.
export const SUPERSTRUCTURE_M = 30

// Apparent-size cap as a fraction of canvas width (keeps a close ship sane).
export const SIZE_CAP_FRAC = 0.25

// Open-Meteo coast bounding box (SW then NE), hugging the visible water.
export const BBOX = [[12.02, -69.12], [12.20, -68.84]]

// Sightline (Koschmieder) calibration knobs — tuned by eye in m6.
export const SIGHTLINE = {
  scaleHeightKm: 1.5,  // aerosol vertical scale height
  humCoef: 0.8,        // how strongly humidity swells aerosol extinction
  humPow: 3,           // humidity growth steepness
  maxKm: 200,          // clamp for very clean air
  bandKm: 15           // half-width of the "barely visible" band around 70 km
}

// Palette.
export const PALETTE = {
  skyTop: '#7fb6e6', skyBottom: '#dceaf3',
  seaTop: '#bcd6df', seaBottom: '#3f7d92',
  horizon: '#2c5b6b',
  ship: '#1e3a44',
  haze: '#cfe0e8',
  travertine: '#efe9dd',
  glass: 'rgba(210,230,235,0.10)',
  palm: 'rgba(20,30,28,0.55)'
}
```

---

## Task 3: `geometry.js` — the physics core (TDD)

**Files:**
- Create: `public/js/geometry.js`
- Test: `public/js/geometry.test.js`

This is the heart. Every function is pure. Write the tests first.

- [ ] **Step 1: Write the failing tests `public/js/geometry.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toRad, normalizeSigned, bearingTo, haversineKm, horizonKm,
  shipHorizonKm, projectX, apparentWidthPx, hullDownState, nearness
} from './geometry.js'

const near = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`)

test('toRad', () => near(toRad(180), Math.PI, 1e-9))

test('normalizeSigned wraps to [-180,180]', () => {
  near(normalizeSigned(6), 6, 1e-9)
  near(normalizeSigned(200), -160, 1e-9)
  near(normalizeSigned(-190), 170, 1e-9)
  near(normalizeSigned(360), 0, 1e-9)
})

test('bearingTo cardinal directions', () => {
  near(bearingTo(0, 0, 1, 0), 0)     // north
  near(bearingTo(0, 0, 0, 1), 90)    // east
  near(bearingTo(0, 0, -1, 0), 180)  // south
  near(bearingTo(0, 0, 0, -1), 270)  // west
})

test('haversineKm ~111 km per degree on a sphere', () => {
  near(haversineKm(0, 0, 0, 1), 111.19)
  near(haversineKm(0, 0, 1, 0), 111.19)
})

test('horizonKm = 3.57*sqrt(h)', () => {
  near(horizonKm(28), 18.89, 0.05)
  near(horizonKm(0), 0, 1e-9)
})

test('shipHorizonKm adds deck + superstructure horizons', () => {
  near(shipHorizonKm(28, 30), 18.89 + horizonKm(30), 0.05)
})

test('projectX maps bearing to x, culls outside fov', () => {
  const W = 1000, vb = 202, fov = 108
  near(projectX(202, vb, fov, W), 500)   // centre
  near(projectX(256, vb, fov, W), 1000)  // +fov/2 -> right edge
  near(projectX(148, vb, fov, W), 0)     // -fov/2 -> left edge
  assert.equal(projectX(300, vb, fov, W), null) // beyond half-fov -> culled
})

test('apparentWidthPx shrinks with distance and caps', () => {
  const W = 1000, fov = 108
  near(apparentWidthPx(200, 10, fov, W, 0.25), 10.6, 0.3)
  // 300 m ship at 0.5 km would exceed the cap -> clamped to 0.25*W
  near(apparentWidthPx(300, 0.5, fov, W, 0.25), 250, 1e-6)
})

test('hullDownState: full / hulldown / gone', () => {
  assert.equal(hullDownState(10, 28, 30).state, 'full')
  assert.equal(hullDownState(25, 28, 30).state, 'hulldown')
  assert.equal(hullDownState(40, 28, 30).state, 'gone')
})

test('nearness is 1 near, 0 far, clamped', () => {
  near(nearness(4, 4, 55), 1, 1e-9)
  near(nearness(55, 4, 55), 0, 1e-9)
  near(nearness(29.5, 4, 55), 0.5, 1e-9)
  near(nearness(1, 4, 55), 1, 1e-9) // clamped
})
```

- [ ] **Step 2: Run the tests; confirm they fail**

Run: `node --test public/js/geometry.test.js`
Expected: FAIL — cannot import from `./geometry.js` (module/exports missing).

- [ ] **Step 3: Implement `public/js/geometry.js`**

```js
export const toRad = d => d * Math.PI / 180
export const toDeg = r => r * 180 / Math.PI

const R_KM = 6371

// Wrap an angle (deg) to (-180, 180].
export function normalizeSigned(deg) {
  let x = ((deg + 180) % 360 + 360) % 360 - 180
  return x === -180 ? 180 : x
}

// Initial great-circle bearing from A to B, degrees 0..360 (0 = north).
export function bearingTo(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1), p2 = toRad(lat2), dl = toRad(lon2 - lon1)
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// Great-circle distance, km.
export function haversineKm(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1), p2 = toRad(lat2)
  const dp = toRad(lat2 - lat1), dl = toRad(lon2 - lon1)
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Geometric distance to the sea horizon from height h (m), km.
export const horizonKm = h => 3.57 * Math.sqrt(Math.max(0, h))

// Max distance a ship's superstructure stays visible from the deck.
export const shipHorizonKm = (deckH, superH) => horizonKm(deckH) + horizonKm(superH)

// Horizontal screen x for a ship bearing, or null if outside the field of view.
export function projectX(bearing, viewBearing, fov, width) {
  const d = normalizeSigned(bearing - viewBearing)
  if (Math.abs(d) > fov / 2) return null
  return width * (0.5 + d / fov)
}

// Apparent on-screen width (px) via small-angle geometry, capped.
export function apparentWidthPx(lengthM, distanceKm, fov, width, capFrac) {
  const angular = lengthM / (distanceKm * 1000)          // radians
  const px = angular * (width / toRad(fov))
  return Math.min(px, capFrac * width)
}

// Hull-down classification. clipFrac is how much of the hull is hidden (0..1).
export function hullDownState(distanceKm, deckH, superH) {
  const sea = horizonKm(deckH)
  const top = shipHorizonKm(deckH, superH)
  if (distanceKm <= sea) return { state: 'full', clipFrac: 0 }
  if (distanceKm <= top) return { state: 'hulldown', clipFrac: (distanceKm - sea) / (top - sea) }
  return { state: 'gone', clipFrac: 1 }
}

// 0..1 nearness for the vertical-spread nudge (1 = closest, 0 = far edge).
export function nearness(distanceKm, nearKm, farKm) {
  return Math.max(0, Math.min(1, (farKm - distanceKm) / (farKm - nearKm)))
}
```

- [ ] **Step 4: Run the tests; confirm they pass**

Run: `node --test public/js/geometry.test.js`
Expected: PASS — all geometry tests green.

- [ ] **Step 5: Commit**

```bash
git add public/js/config.js public/js/geometry.js public/js/geometry.test.js
git commit -m "feat: deck config and physics-honest geometry core with tests"
```

---

## Task 4: `server/static.js` — zero-dep static server (TDD)

**Files:**
- Create: `server/static.js`
- Test: `server/static.test.js`

- [ ] **Step 1: Write the failing test `server/static.test.js`**

```js
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from './static.js'

const server = createServer('public')
await new Promise(res => server.listen(0, res))
const port = server.address().port
const base = `http://127.0.0.1:${port}`
after(() => server.close())

test('serves index.html as text/html', async () => {
  const r = await fetch(`${base}/`)
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type'), /text\/html/)
})

test('serves js with javascript MIME', async () => {
  const r = await fetch(`${base}/js/config.js`)
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type'), /javascript/)
})

test('blocks path traversal', async () => {
  const r = await fetch(`${base}/../package.json`)
  assert.ok(r.status === 403 || r.status === 404)
})

test('404 for missing files', async () => {
  const r = await fetch(`${base}/nope.js`)
  assert.equal(r.status, 404)
})
```

- [ ] **Step 2: Run the test; confirm it fails**

Run: `node --test server/static.test.js`
Expected: FAIL — `createServer` not exported (and `public/index.html` / `public/js/config.js` may not yet exist; `config.js` exists from Task 2, `index.html` arrives in Task 5 — until then the index test may 404; that is fine, re-run after Task 5).

- [ ] **Step 3: Implement `server/static.js`**

```js
import { createServer as httpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, normalize, join, extname } from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

export function createServer(rootDir) {
  const root = resolve(rootDir)
  return httpServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
      let filePath = join(root, rel)
      if (!filePath.startsWith(root)) { res.writeHead(403).end('forbidden'); return }
      if (urlPath.endsWith('/')) filePath = join(filePath, 'index.html')
      const body = await readFile(filePath)
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
}

// Run directly: `node server/static.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 5173
  createServer('public').listen(port, () => {
    console.log(`BB45 dev server: http://localhost:${port}`)
  })
}
```

- [ ] **Step 4: Run the test**

Run: `node --test server/static.test.js`
Expected: the traversal, MIME-for-js, and 404 tests PASS. The `/` index test passes once `public/index.html` exists (Task 5) — note it and move on.

- [ ] **Step 5: Commit**

```bash
git add server/static.js server/static.test.js
git commit -m "feat: zero-dep static dev server with MIME + traversal guard"
```

---

## Task 5: `index.html` + `main.js` canvas bootstrap

**Files:**
- Create: `public/index.html`
- Create: `public/js/main.js`

Visual scaffolding — verified in the browser. Establishes the resize-aware canvas and the render loop.

- [ ] **Step 1: Write `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BB45 — Blue Bay</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0c1014; overflow: hidden; }
    #view { display: block; width: 100vw; height: 100vh; }
    .panel {
      position: fixed; z-index: 2; color: #eef4f7;
      font: 13px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif;
      background: rgba(12, 20, 26, 0.55); backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; padding: 12px 14px;
    }
    #wx { top: 14px; left: 14px; min-width: 150px; }
    #see { top: 14px; right: 14px; min-width: 190px; }
    .panel h2 { margin: 0 0 6px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; opacity: .7; }
    .panel .row { display: flex; justify-content: space-between; gap: 14px; }
    #see input[type=range] { width: 100%; }
    .btns { display: flex; gap: 8px; margin-top: 8px; }
    .btns button {
      flex: 1; cursor: pointer; color: #eef4f7; background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; padding: 5px 0; font-size: 12px;
    }
    #tooltip {
      position: fixed; z-index: 3; pointer-events: none; display: none; max-width: 240px;
      color: #eef4f7; font: 12px/1.4 -apple-system, "Segoe UI", system-ui, sans-serif;
      background: rgba(10, 16, 20, 0.86); border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px; padding: 8px 10px;
    }
    #tooltip b { font-size: 13px; }
    #tooltip .hd { color: #ffd27a; }
  </style>
</head>
<body>
  <canvas id="view"></canvas>

  <section id="wx" class="panel">
    <h2>Weather</h2>
    <div id="wx-body">loading…</div>
  </section>

  <section id="see" class="panel">
    <h2>How far you can see</h2>
    <div id="verdict">—</div>
    <div class="row" style="margin-top:8px"><span>Sightline</span><span id="sl-val">— km</span></div>
    <input id="sl" type="range" min="2" max="200" step="1" value="40">
    <div class="btns">
      <button id="drift">⏸ Drift</button>
      <button id="livewx">◉ Live wx</button>
    </div>
  </section>

  <div id="tooltip"></div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `public/js/main.js` (bootstrap only — modules wired in later tasks)**

```js
const canvas = document.getElementById('view')
const ctx = canvas.getContext('2d')

let W = 0, H = 0, dpr = 1
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = canvas.clientWidth; H = canvas.clientHeight
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
window.addEventListener('resize', resize)
resize()

function frame(t) {
  ctx.clearRect(0, 0, W, H)
  // Temporary proof-of-life: vertical gradient so we can confirm the loop runs.
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#7fb6e6'); g.addColorStop(1, '#3f7d92')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
```

- [ ] **Step 3: Run the server and verify in the browser**

Run: `npm start`
Then open `http://localhost:5173`.
Expected: a full-window sky-to-sea vertical gradient, no console errors, resizes crisply when you resize the window.

- [ ] **Step 4: Re-run the static server test (the index test now has its file)**

Run: `node --test server/static.test.js`
Expected: all four tests PASS now.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/main.js
git commit -m "feat: canvas bootstrap, panel shell, dev render loop"
```

---

## Task 6: `scene.js` — sky, sea, sun, glitter, clouds, curved horizon

**Files:**
- Create: `public/js/scene.js`

Concrete first implementation; tune by eye. Exports a `horizonY(W,H)` used by everything that places ships, plus `drawSky`/`drawSea`/`drawClouds`.

- [ ] **Step 1: Write `public/js/scene.js` (sky/sea/horizon portion)**

```js
import { PALETTE } from './config.js'

// The horizon sits a bit above mid-screen so there is open water to place ships in.
export const horizonY = (W, H) => Math.round(H * 0.42)

// Slight earth curvature: how far the horizon dips at the edges (px).
const curveDip = W => Math.max(6, W * 0.012)

function horizonPath(ctx, W, H) {
  const y = horizonY(W, H), dip = curveDip(W)
  ctx.beginPath()
  ctx.moveTo(0, y + dip)
  ctx.quadraticCurveTo(W / 2, y - dip, W, y + dip)
}

export function drawSky(ctx, W, H, t) {
  const y = horizonY(W, H)
  const g = ctx.createLinearGradient(0, 0, 0, y)
  g.addColorStop(0, PALETTE.skyTop); g.addColorStop(1, PALETTE.skyBottom)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, y + 2)

  // Soft sun, low over the SSW horizon (roughly where the view centre is).
  const sx = W * 0.5, sy = y - H * 0.16
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.22)
  sun.addColorStop(0, 'rgba(255,248,228,0.95)')
  sun.addColorStop(0.4, 'rgba(255,240,205,0.35)')
  sun.addColorStop(1, 'rgba(255,240,205,0)')
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, y + 2)
}

export function drawSea(ctx, W, H, t) {
  const y = horizonY(W, H)
  const g = ctx.createLinearGradient(0, y, 0, H)
  g.addColorStop(0, PALETTE.seaTop); g.addColorStop(1, PALETTE.seaBottom)
  // Clip the sea to the curved horizon so the dip reads.
  ctx.save()
  horizonPath(ctx, W, H); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip()
  ctx.fillStyle = g; ctx.fillRect(0, y - curveDip(W), W, H)

  // Sun-glitter streak descending from the sun toward the viewer.
  const cx = W * 0.5
  for (let i = 0; i < 60; i++) {
    const fy = y + (H - y) * (i / 60)
    const spread = 6 + (i / 60) * W * 0.10
    const a = 0.10 * (1 - i / 60) * (0.6 + 0.4 * Math.sin(t / 400 + i))
    ctx.fillStyle = `rgba(255,250,235,${a.toFixed(3)})`
    ctx.fillRect(cx - spread, fy, spread * 2, 2)
  }
  ctx.restore()

  // Thin horizon line.
  ctx.strokeStyle = PALETTE.horizon; ctx.lineWidth = 1; ctx.globalAlpha = 0.5
  horizonPath(ctx, W, H); ctx.stroke(); ctx.globalAlpha = 1
}

export function drawClouds(ctx, W, H, t) {
  const y = horizonY(W, H)
  ctx.save()
  for (let i = 0; i < 5; i++) {
    const speed = 0.004 + i * 0.0015
    const cx = ((t * speed + i * 320) % (W + 360)) - 180
    const cy = y * (0.25 + 0.12 * i)
    const s = 50 + i * 18
    ctx.fillStyle = `rgba(255,255,255,${0.18 - i * 0.02})`
    for (const [ox, oy, r] of [[-s, 6, s * 0.7], [0, 0, s], [s, 8, s * 0.6], [s * 0.4, 12, s * 0.8]]) {
      ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}
```

- [ ] **Step 2: Wire scene into `main.js`** (replace the temporary gradient block)

Replace the body of `frame` in `public/js/main.js` with:

```js
import { drawSky, drawSea, drawClouds } from './scene.js'

// ...keep canvas/ctx/resize from Task 5...

function frame(t) {
  ctx.clearRect(0, 0, W, H)
  drawSky(ctx, W, H, t)
  drawClouds(ctx, W, H, t)
  drawSea(ctx, W, H, t)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
```

(Move the two `import` lines to the top of `main.js`.)

- [ ] **Step 3: Verify in the browser**

Run: `npm start` (if not already running), reload `http://localhost:5173`.
Expected: gradient sky with a soft sun glow, drifting clouds, sea with a shimmering central glitter streak, and a faint gently-curved horizon line above mid-screen. No console errors.

- [ ] **Step 4: Commit**

```bash
git add public/js/scene.js public/js/main.js
git commit -m "feat: sky, sun, drifting clouds, sea glitter, curved horizon"
```

---

## Task 7: `scene.js` — deck (travertine + frameless glass), corner palms, compass strip

**Files:**
- Modify: `public/js/scene.js`

- [ ] **Step 1: Append foreground draw functions to `public/js/scene.js`**

```js
import { normalizeSigned, projectX } from './geometry.js'
import { DECK, LANDFALL } from './config.js'

// Bottom band of travertine, a faint frameless glass tint above it.
export function drawDeck(ctx, W, H) {
  const stoneH = Math.max(26, H * 0.05)
  const top = H - stoneH

  // Faint glass: a barely-there tint + a soft top reflection, no posts, no rail.
  const glass = ctx.createLinearGradient(0, top - H * 0.20, 0, top)
  glass.addColorStop(0, 'rgba(210,230,235,0.00)')
  glass.addColorStop(1, 'rgba(210,230,235,0.12)')
  ctx.fillStyle = glass; ctx.fillRect(0, top - H * 0.20, W, H * 0.20)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, top - 2, W, 2)

  // Travertine band with subtle perspective seams.
  const g = ctx.createLinearGradient(0, top, 0, H)
  g.addColorStop(0, '#f4efe4'); g.addColorStop(1, '#d9d1c0')
  ctx.fillStyle = g; ctx.fillRect(0, top, W, stoneH)
  ctx.strokeStyle = 'rgba(120,110,90,0.18)'; ctx.lineWidth = 1
  for (let i = 1; i < 5; i++) {
    const x = (W / 4) * i + (i - 2.5) * 10
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + (i - 2.5) * 14, H); ctx.stroke()
  }
}

// Dark semi-transparent palm silhouettes intruding ~15% into each bottom corner.
export function drawPalms(ctx, W, H, t) {
  const intr = 0.15
  drawPalm(ctx, W, H, t, false, intr)        // bottom-left
  drawPalm(ctx, W, H, t, true, intr)         // bottom-right (mirrored)
}

function drawPalm(ctx, W, H, t, mirror, intr) {
  ctx.save()
  if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1) }
  ctx.fillStyle = 'rgba(20,30,28,0.55)'
  ctx.strokeStyle = 'rgba(20,30,28,0.55)'
  // Trunk rising from off-frame at the corner.
  const bx = -W * 0.02, by = H * 1.02
  ctx.lineWidth = Math.max(6, W * 0.008)
  ctx.beginPath(); ctx.moveTo(bx, by)
  ctx.quadraticCurveTo(W * 0.06, H * 0.7, W * 0.10, H * 0.34); ctx.stroke()
  const cx = W * 0.10, cy = H * 0.34
  // Fronds arcing inward over the top edge of the corner.
  for (let i = 0; i < 6; i++) {
    const ang = -0.2 + i * 0.42 + 0.04 * Math.sin(t / 900 + i)
    const len = W * (0.16 + intr * 0.6)
    const ex = cx + Math.cos(ang) * len, ey = cy + Math.sin(ang) * len * 0.7
    ctx.lineWidth = Math.max(2, W * 0.003)
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.quadraticCurveTo(cx + (ex - cx) * 0.5, cy - H * 0.06, ex, ey); ctx.stroke()
  }
  ctx.restore()
}

// Thin bearing strip just above the stone band: degree + cardinal ticks.
export function drawCompass(ctx, W, H) {
  const stoneH = Math.max(26, H * 0.05)
  const y = H - stoneH - 16
  const CARD = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }
  ctx.save()
  ctx.fillStyle = 'rgba(238,244,247,0.75)'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  for (let deg = 0; deg < 360; deg += 5) {
    const d = normalizeSigned(deg - DECK.viewBearing)
    if (Math.abs(d) > DECK.fov / 2) continue
    const x = W * (0.5 + d / DECK.fov)
    const major = deg % 15 === 0
    ctx.globalAlpha = major ? 0.8 : 0.4
    ctx.fillRect(x, y, 1, major ? 7 : 4)
    if (CARD[deg]) { ctx.globalAlpha = 0.9; ctx.fillText(CARD[deg], x, y - 3) }
    else if (deg % 15 === 0) { ctx.globalAlpha = 0.6; ctx.fillText(String(deg), x, y - 3) }
  }
  ctx.restore()
}

// Faint Venezuela ridge, fading in with sightline confidence (opacity 0..1).
// Drawn at the landfall bearing, sitting on the horizon, behind ships.
export function drawLandfall(ctx, W, H, opacity) {
  if (!opacity || opacity <= 0.01) return
  const cx = projectX(LANDFALL.bearing, DECK.viewBearing, DECK.fov, W)
  if (cx == null) return
  const y = horizonY(W, H)
  const span = W * 0.42        // how wide the coast reads across the view
  const peak = H * 0.06        // apparent height of the ~900 m peaks
  ctx.save()
  ctx.globalAlpha = Math.min(0.6, opacity * 0.6)
  const g = ctx.createLinearGradient(0, y - peak, 0, y)
  g.addColorStop(0, 'rgba(90,110,130,0.0)')
  g.addColorStop(1, 'rgba(70,92,112,0.9)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(cx - span / 2, y)
  // A couple of soft ridge humps so it reads as distant mountains, not a block.
  ctx.quadraticCurveTo(cx - span * 0.25, y - peak * 0.7, cx - span * 0.08, y - peak * 0.45)
  ctx.quadraticCurveTo(cx, y - peak, cx + span * 0.18, y - peak * 0.55)
  ctx.quadraticCurveTo(cx + span * 0.32, y - peak * 0.85, cx + span / 2, y)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
```

- [ ] **Step 2: Add the foreground to the `main.js` frame** (draw AFTER sea, but ships will later go between sea and deck)

In `public/js/main.js`, update imports and the `frame` body:

```js
import { drawSky, drawSea, drawClouds, drawDeck, drawPalms, drawCompass } from './scene.js'

function frame(t) {
  ctx.clearRect(0, 0, W, H)
  drawSky(ctx, W, H, t)
  drawClouds(ctx, W, H, t)
  drawSea(ctx, W, H, t)
  drawCompass(ctx, W, H)
  // ships will be drawn here in Task 12
  drawDeck(ctx, W, H)
  drawPalms(ctx, W, H, t)
  requestAnimationFrame(frame)
}
```

- [ ] **Step 3: Verify in the browser**

Reload `http://localhost:5173`.
Expected: a thin travertine band along the very bottom with a faint glass tint above it (water reads straight through), a palm silhouette arcing in from each bottom corner (~15% intrusion), and a thin bearing strip with N/NE/E… ticks just above the stone. The view centre tick should read ~202°/between S and SW.

- [ ] **Step 4: Commit**

```bash
git add public/js/scene.js public/js/main.js
git commit -m "feat: travertine deck, frameless glass, corner palms, compass strip"
```

---

## Task 8: `sim.js` — simulated fleet (TDD for motion + recycling)

**Files:**
- Create: `public/js/sim.js`
- Test: `public/js/sim.test.js`

- [ ] **Step 1: Write the failing tests `public/js/sim.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advanceShip, needsRecycle, makeFleet } from './sim.js'
import { bearingTo, haversineKm, normalizeSigned } from './geometry.js'
import { DECK } from './config.js'

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`)

test('advanceShip moves east along course 90', () => {
  const s = { lat: 12, lon: -69, course: 90, kn: 10 }
  advanceShip(s, 3600, 1) // 1 hour, speedup 1 -> 10 nm = 18.52 km east
  near(s.lat, 12, 1e-3)
  near(s.lon, -69 + 0.1703, 2e-3)
})

test('advanceShip moves north along course 0', () => {
  const s = { lat: 12, lon: -69, course: 0, kn: 10 }
  advanceShip(s, 3600, 1)
  near(s.lat, 12 + 0.1665, 2e-3)
  near(s.lon, -69, 1e-3)
})

test('needsRecycle true when beyond the field of view', () => {
  // A ship due north of the deck is ~160° off a 202° view centre -> outside fov.
  const s = { lat: DECK.lat + 0.5, lon: DECK.lon, course: 0, kn: 10 }
  assert.equal(needsRecycle(s, DECK, 55), true)
})

test('needsRecycle true when farther than maxKm', () => {
  const s = { lat: DECK.lat - 0.9, lon: DECK.lon - 0.1, course: 0, kn: 10 }
  const far = haversineKm(DECK.lat, DECK.lon, s.lat, s.lon) > 55
  assert.equal(needsRecycle(s, DECK, 55), far)
})

test('makeFleet places every ship inside the view arc and envelope', () => {
  const fleet = makeFleet()
  assert.ok(fleet.length >= 8)
  for (const s of fleet) {
    const d = haversineKm(DECK.lat, DECK.lon, s.lat, s.lon)
    const off = Math.abs(normalizeSigned(bearingTo(DECK.lat, DECK.lon, s.lat, s.lon) - DECK.viewBearing))
    assert.ok(off <= DECK.fov / 2, `ship ${s.name} bearing off-arc: ${off}`)
    assert.ok(d >= 4 && d <= 55, `ship ${s.name} distance out of envelope: ${d}`)
  }
})
```

- [ ] **Step 2: Run the tests; confirm they fail**

Run: `node --test public/js/sim.test.js`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement `public/js/sim.js`**

```js
import { toRad, bearingTo, haversineKm, normalizeSigned } from './geometry.js'
import { DECK, NEAR_KM, FAR_KM } from './config.js'

const KM_PER_DEG = 111.195
const SPEEDUP = 90 // accelerate drift so motion is visible

// Move a ship along its course. dtSec real seconds, speedup multiplies distance.
export function advanceShip(s, dtSec, speedup = SPEEDUP) {
  const km = s.kn * 1.852 * (dtSec / 3600) * speedup
  const c = toRad(s.course)
  s.lat += (km / KM_PER_DEG) * Math.cos(c)
  s.lon += (km / (KM_PER_DEG * Math.cos(toRad(s.lat)))) * Math.sin(c)
}

export function needsRecycle(s, deck = DECK, maxKm = FAR_KM) {
  const d = haversineKm(deck.lat, deck.lon, s.lat, s.lon)
  const off = Math.abs(normalizeSigned(bearingTo(deck.lat, deck.lon, s.lat, s.lon) - deck.viewBearing))
  return d > maxKm || d < 1 || off > deck.fov / 2
}

// Respawn a ship somewhere fresh inside the arc, biased to the far side.
export function recycle(s, deck = DECK) {
  const sign = Math.random() < 0.5 ? -1 : 1
  const off = sign * (deck.fov / 2) * (0.55 + Math.random() * 0.4)
  const brg = (deck.viewBearing + off + 360) % 360
  const dist = 28 + Math.random() * 24 // 28..52 km, out near the horizon
  const b = toRad(brg), dDeg = dist / KM_PER_DEG
  s.lat = deck.lat + dDeg * Math.cos(b)
  s.lon = deck.lon + dDeg * Math.sin(b) / Math.cos(toRad(deck.lat))
  // Aim the course generally across the view so it drifts through the arc.
  s.course = (deck.viewBearing + (sign < 0 ? 90 : -90) + (Math.random() * 40 - 20) + 360) % 360
}

export function stepFleet(fleet, dtSec, deck = DECK) {
  for (const s of fleet) {
    advanceShip(s, dtSec)
    if (needsRecycle(s, deck)) recycle(s, deck)
  }
}

// ~9 plausible vessels. Placed by bearing offset + distance, then converted to lat/lon.
const SEED = [
  { name: 'Maersk Batam', flag: '🇸🇬', type: 'container', dest: 'Willemstad', len: 300, kn: 14, off: -28, dist: 22 },
  { name: 'Bonaire Star', flag: '🇳🇱', type: 'coaster', dest: 'Kralendijk', len: 95, kn: 11, off: -10, dist: 9 },
  { name: 'Caribbean Dawn', flag: '🇧🇸', type: 'cruise', dest: 'Willemstad', len: 290, kn: 17, off: 6, dist: 14 },
  { name: 'Aframax Carina', flag: '🇱🇷', type: 'tanker', dest: 'Punta Cardón', len: 245, kn: 12, off: 20, dist: 31 },
  { name: 'Isla Cargo', flag: '🇵🇦', type: 'bulk', dest: 'Oranjestad', len: 180, kn: 10, off: 34, dist: 40 },
  { name: 'Sea Breeze', flag: '🇫🇷', type: 'yacht', dest: 'Spanish Water', len: 38, kn: 8, off: -18, dist: 6 },
  { name: 'Antilla Trader', flag: '🇵🇦', type: 'coaster', dest: 'La Guaira', len: 110, kn: 12, off: 14, dist: 26 },
  { name: 'Gulf Pioneer', flag: '🇲🇭', type: 'tanker', dest: 'Amuay', len: 250, kn: 13, off: -40, dist: 45 },
  { name: 'Blue Horizon', flag: '🇬🇧', type: 'cruise', dest: 'Willemstad', len: 270, kn: 16, off: 40, dist: 18 }
]

export function makeFleet() {
  return SEED.map((v, i) => {
    const brg = (DECK.viewBearing + v.off + 360) % 360
    const b = toRad(brg), dDeg = v.dist / KM_PER_DEG
    const lat = DECK.lat + dDeg * Math.cos(b)
    const lon = DECK.lon + dDeg * Math.sin(b) / Math.cos(toRad(DECK.lat))
    const course = (DECK.viewBearing + (v.off < 0 ? 80 : -80) + 360) % 360
    return { id: i, name: v.name, flag: v.flag, type: v.type, dest: v.dest, len: v.len, kn: v.kn, course, lat, lon }
  })
}
```

Note: `NEAR_KM` is imported for symmetry with config but recycling uses the `FAR_KM`
envelope; keep the import only if used, otherwise drop it to avoid an unused symbol.
(For this task `NEAR_KM` is not referenced — remove it from the import line.)

Corrected import line:

```js
import { DECK, FAR_KM } from './config.js'
```

- [ ] **Step 4: Run the tests; confirm they pass**

Run: `node --test public/js/sim.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/js/sim.js public/js/sim.test.js
git commit -m "feat: simulated fleet with accelerated drift and recycling, tested"
```

---

## Task 9: `ships.js` — silhouettes, haze fade, hit-testing (TDD the hit-test)

**Files:**
- Create: `public/js/ships.js`
- Test: `public/js/ships.test.js`

`drawShip` is visual (verified in Task 12). `shipAtPoint` is pure and tested here.

- [ ] **Step 1: Write the failing test `public/js/ships.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shipAtPoint } from './ships.js'

// rects: {ref, x, y, w, h} where x,y is top-left of the ship's hit box.
const rects = [
  { ref: 'far', x: 100, y: 100, w: 20, h: 8 },
  { ref: 'near', x: 90, y: 96, w: 60, h: 24 } // drawn later -> on top where they overlap
]

test('returns the topmost ship under the point', () => {
  assert.equal(shipAtPoint(rects, 110, 104).ref, 'near')
})

test('returns null when nothing is hit', () => {
  assert.equal(shipAtPoint(rects, 5, 5), null)
})

test('hits a non-overlapping ship', () => {
  assert.equal(shipAtPoint([rects[0]], 105, 103).ref, 'far')
})
```

- [ ] **Step 2: Run the test; confirm it fails**

Run: `node --test public/js/ships.test.js`
Expected: FAIL — `shipAtPoint` not exported.

- [ ] **Step 3: Implement `public/js/ships.js`**

```js
import { PALETTE, DECK, SUPERSTRUCTURE_M, SIZE_CAP_FRAC } from './config.js'
import { apparentWidthPx, hullDownState, nearness } from './geometry.js'

// Topmost (last-drawn) ship whose hit box contains the point, else null.
export function shipAtPoint(rects, px, py) {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i]
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r
  }
  return null
}

// Atmospheric-perspective alpha: solid up close, fading into haze near the limit.
function hazeAlpha(distanceKm, limitKm) {
  const t = Math.min(1, distanceKm / limitKm)
  return Math.max(0.12, 1 - t * t)
}

// Per-type silhouette painters draw a unit ship into a w×h box at (0,0) origin
// (origin = waterline-left). Kept simple; tuned by eye.
const SILHOUETTES = {
  container: (ctx, w, h) => {
    ctx.fillRect(0, -h * 0.35, w, h * 0.35)            // hull
    for (let i = 0; i < 6; i++) ctx.fillRect(w * (0.08 + i * 0.14), -h, w * 0.10, h * 0.65) // stacks
  },
  tanker: (ctx, w, h) => {
    ctx.fillRect(0, -h * 0.4, w, h * 0.4)
    ctx.fillRect(w * 0.78, -h, w * 0.16, h * 0.6)      // aft house
    ctx.fillRect(w * 0.2, -h * 0.62, w * 0.5, h * 0.18) // manifold line
  },
  bulk: (ctx, w, h) => {
    ctx.fillRect(0, -h * 0.4, w, h * 0.4)
    ctx.fillRect(w * 0.8, -h * 0.95, w * 0.16, h * 0.55)
    for (let i = 0; i < 4; i++) ctx.fillRect(w * (0.12 + i * 0.16), -h * 0.55, w * 0.06, h * 0.18) // cranes
  },
  cruise: (ctx, w, h) => {
    ctx.fillRect(0, -h * 0.45, w, h * 0.45)
    ctx.fillRect(w * 0.06, -h, w * 0.88, h * 0.6)      // tall white block
    ctx.fillRect(w * 0.7, -h * 1.15, w * 0.12, h * 0.2)
  },
  coaster: (ctx, w, h) => {
    ctx.fillRect(0, -h * 0.45, w, h * 0.45)
    ctx.fillRect(w * 0.72, -h * 0.95, w * 0.2, h * 0.55)
  },
  yacht: (ctx, w, h) => {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, -h * 0.2); ctx.lineTo(w * 0.85, h * 0.05); ctx.lineTo(0, h * 0.05)
    ctx.closePath(); ctx.fill()
    ctx.fillRect(w * 0.35, -h * 0.7, w * 0.3, h * 0.5)
  }
}

// Draw one ship and return its screen hit box (or null if culled/gone).
// ctx: 2d context; W,H canvas size; x: projected centre x; distanceKm: range;
// horizonY/seaBottomY: vertical anchors; exaggeration: 0..1.
export function drawShip(ctx, s, x, distanceKm, W, H, horizonY, seaBottomY, exaggeration, nearKm, farKm) {
  const hd = hullDownState(distanceKm, DECK.height, SUPERSTRUCTURE_M)
  if (hd.state === 'gone') return null

  const w = Math.max(3, apparentWidthPx(s.len, distanceKm, DECK.fov, W, SIZE_CAP_FRAC))
  const h = w * 0.42

  // Vertical: honest baseline at the horizon, nudged down by nearness * exaggeration.
  const near = nearness(distanceKm, nearKm, farKm)
  const drop = exaggeration * near * (seaBottomY - horizonY) * 0.9
  const baseY = horizonY + drop

  ctx.save()
  ctx.globalAlpha = hazeAlpha(distanceKm, farKm)
  // Blend toward haze colour for distance (cheap atmospheric tint).
  ctx.fillStyle = hd.state === 'hulldown' ? mix(PALETTE.ship, PALETTE.haze, 0.35) : PALETTE.ship
  ctx.translate(x - w / 2, baseY)

  // Hull-down: clip away the lower hull below the horizon line.
  if (hd.state === 'hulldown') {
    ctx.beginPath(); ctx.rect(-w, -h * 2, w * 3, h * 2 - hd.clipFrac * h * 0.4); ctx.clip()
  }
  ;(SILHOUETTES[s.type] || SILHOUETTES.coaster)(ctx, w, h)
  ctx.restore()

  return { ref: s.id, ship: s, distanceKm, hullDown: hd.state === 'hulldown',
           x: x - w / 2, y: baseY - h * 1.2, w, h: h * 1.4 }
}

function mix(a, b, t) {
  const pa = hex(a), pb = hex(b)
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
function hex(s) {
  const m = s.replace('#', '')
  return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16))
}
```

- [ ] **Step 4: Run the test; confirm it passes**

Run: `node --test public/js/ships.test.js`
Expected: PASS (importing `ships.js` under Node is fine — no DOM at import time).

- [ ] **Step 5: Commit**

```bash
git add public/js/ships.js public/js/ships.test.js
git commit -m "feat: type silhouettes, haze fade, hull-down clip, hit-test (tested)"
```

---

## Task 10: `weather.js` — Open-Meteo + Koschmieder sightline (TDD the math)

**Files:**
- Create: `public/js/weather.js`
- Test: `public/js/weather.test.js`

- [ ] **Step 1: Write the failing tests `public/js/weather.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { humidityFactor, sightlineKm, venezuelaVerdict } from './weather.js'

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`)

test('humidityFactor grows with RH', () => {
  near(humidityFactor(0), 1, 1e-9)
  assert.ok(humidityFactor(90) > humidityFactor(50))
})

test('sightlineKm: clean air sees far, dusty air does not', () => {
  const clean = sightlineKm(0.08, 45)
  const dusty = sightlineKm(0.40, 80)
  assert.ok(clean > 50, `clean ${clean}`)
  assert.ok(dusty < 20, `dusty ${dusty}`)
  assert.ok(clean > dusty)
})

test('venezuelaVerdict: hidden / barely / clear around 70 km', () => {
  assert.equal(venezuelaVerdict(12, 70).state, 'hidden')
  assert.equal(venezuelaVerdict(70, 70).state, 'barely')
  assert.equal(venezuelaVerdict(110, 70).state, 'clear')
  near(venezuelaVerdict(70, 70).opacity, 0.5, 0.05)
})
```

- [ ] **Step 2: Run the tests; confirm they fail**

Run: `node --test public/js/weather.test.js`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement `public/js/weather.js`**

```js
import { DECK, LANDFALL, SIGHTLINE } from './config.js'

// Hygroscopic growth: humidity swells aerosol, raising extinction.
export function humidityFactor(rh) {
  return 1 + SIGHTLINE.humCoef * Math.pow(Math.max(0, Math.min(1, rh / 100)), SIGHTLINE.humPow)
}

// Koschmieder long-range visual range (km) from aerosol optical depth + humidity.
export function sightlineKm(aod, rh) {
  const beta = (Math.max(0.001, aod) / SIGHTLINE.scaleHeightKm) * humidityFactor(rh)
  return Math.min(SIGHTLINE.maxKm, 3.912 / beta)
}

// Verdict for the landfall ridge. opacity 0..1 fades the ghost ridge in.
export function venezuelaVerdict(slKm, distanceKm = LANDFALL.distanceKm) {
  const band = SIGHTLINE.bandKm
  const margin = slKm - distanceKm
  const opacity = Math.max(0, Math.min(1, (margin + band) / (2 * band)))
  let state = 'barely'
  if (margin < -band) state = 'hidden'
  else if (margin > band) state = 'clear'
  return { state, opacity, margin }
}

// --- Live fetch (browser only; not unit-tested) ---

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality'

export async function fetchWeather(lat = DECK.lat, lon = DECK.lon) {
  const f = new URL(FORECAST)
  f.search = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'America/Curacao',
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,visibility'
  })
  const a = new URL(AIR)
  a.search = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'America/Curacao',
    current: 'aerosol_optical_depth,dust'
  })
  const [fr, ar] = await Promise.all([fetch(f).then(r => r.json()), fetch(a).then(r => r.json())])
  const c = fr.current || {}, q = ar.current || {}
  const aod = q.aerosol_optical_depth ?? 0.1
  const rh = c.relative_humidity_2m ?? 70
  const sl = sightlineKm(aod, rh)
  return {
    tempC: c.temperature_2m, rh, windKn: (c.wind_speed_10m ?? 0) / 1.852,
    windDir: c.wind_direction_10m, cloud: c.cloud_cover, code: c.weather_code,
    visKm: (c.visibility ?? 0) / 1000, dust: q.dust, aod,
    sightlineKm: sl, verdict: venezuelaVerdict(sl)
  }
}
```

- [ ] **Step 4: Run the tests; confirm they pass**

Run: `node --test public/js/weather.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/js/weather.js public/js/weather.test.js
git commit -m "feat: Koschmieder aerosol sightline + Open-Meteo fetch, math tested"
```

---

## Task 11: `ui.js` — panels, sightline slider, toggles, tooltip

**Files:**
- Create: `public/js/ui.js`

Pure DOM wiring around the markup from Task 5. Verified by interaction.

- [ ] **Step 1: Write `public/js/ui.js`**

```js
import { DECK } from './config.js'

const COMPASS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
export const compass16 = deg => COMPASS16[Math.round(((deg % 360) / 22.5)) % 16]

const WCODE = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 61: 'Light rain', 63: 'Rain',
  80: 'Showers', 95: 'Thunderstorm' }

export function renderWeather(wx) {
  const el = document.getElementById('wx-body')
  if (!wx) { el.textContent = 'unavailable'; return }
  el.innerHTML = `
    <div class="row"><span>${WCODE[wx.code] || '—'}</span><b>${fmt(wx.tempC)}°C</b></div>
    <div class="row"><span>Wind</span><span>${fmt(wx.windKn)} kn ${compass16(wx.windDir)}</span></div>
    <div class="row"><span>Humidity</span><span>${fmt(wx.rh)}%</span></div>
    <div class="row"><span>Cloud</span><span>${fmt(wx.cloud)}%</span></div>
    <div class="row"><span>Dust AOD</span><span>${(wx.aod ?? 0).toFixed(2)}</span></div>`
}

export function renderVerdict(wx, manualSlKm) {
  const el = document.getElementById('verdict')
  const sl = manualSlKm ?? wx?.sightlineKm
  if (sl == null) { el.textContent = '—'; return }
  const v = wx?.verdict
  const txt = {
    hidden: `Venezuela hidden — Saharan dust. Sightline ≈ ${Math.round(sl)} km.`,
    barely: `On the edge today — can you make out Venezuela? (~70 km)`,
    clear: `Venezuela should be visible — ~70 km, peaks ~900 m.`
  }
  el.textContent = manualSlKm ? `Experimenting: sightline ${Math.round(sl)} km.`
    : (txt[v?.state] || `Sightline ≈ ${Math.round(sl)} km.`)
}

// Wire the slider + toggles. Returns a small state object the loop reads.
export function initControls(onChange) {
  const state = { sightlineKm: 40, drift: true, liveWx: true, manual: false }
  const sl = document.getElementById('sl'), slVal = document.getElementById('sl-val')
  const drift = document.getElementById('drift'), live = document.getElementById('livewx')
  const setSl = v => { slVal.textContent = `${v} km`; }
  setSl(sl.value)
  sl.addEventListener('input', () => { state.sightlineKm = +sl.value; state.manual = true; setSl(sl.value); onChange(state) })
  drift.addEventListener('click', () => { state.drift = !state.drift; drift.textContent = state.drift ? '⏸ Drift' : '▶ Drift'; onChange(state) })
  live.addEventListener('click', () => { state.liveWx = !state.liveWx; live.textContent = state.liveWx ? '◉ Live wx' : '○ Live wx'; onChange(state) })
  return state
}

export function showTooltip(hit, mx, my) {
  const el = document.getElementById('tooltip')
  if (!hit) { el.style.display = 'none'; return }
  const s = hit.ship
  const brg = Math.round(bearingForTip(s))
  el.innerHTML = `<b>${s.flag || ''} ${s.name}</b><br>
    ${s.type} · ${s.dest || '—'}<br>
    ${hit.distanceKm.toFixed(1)} km · ${brg}° ${compass16(brg)}<br>
    ${s.kn} kn · ${s.len} m
    ${hit.hullDown ? '<br><span class="hd">hull-down — superstructure only</span>' : ''}`
  el.style.display = 'block'
  el.style.left = Math.min(mx + 14, window.innerWidth - 250) + 'px'
  el.style.top = (my + 14) + 'px'
}

// Bearing is recomputed by the loop and stashed on the hit; fall back if absent.
function bearingForTip(s) { return s._bearing ?? 0 }
const fmt = v => v == null ? '—' : Math.round(v)
```

Note: `DECK` import is used by future wiring; if unused at lint time, drop it.
The loop (Task 12) sets `s._bearing` before drawing so the tooltip shows the live bearing.

- [ ] **Step 2: Smoke-check the module imports** (no DOM yet exercised)

Run: `node -e "import('./public/js/ui.js').then(m => console.log(typeof m.compass16, m.compass16(202)))"`
Expected: prints `function S` (202° → 'S').

- [ ] **Step 3: Commit**

```bash
git add public/js/ui.js
git commit -m "feat: weather panel, verdict, sightline slider, toggles, tooltip"
```

---

## Task 12: `main.js` — full wiring + hover (integration; STOP after this)

**Files:**
- Modify: `public/js/main.js`

- [ ] **Step 1: Replace `public/js/main.js` with the full wiring**

```js
import { DECK, USE_SIM, EXAGGERATION, NEAR_KM, FAR_KM } from './config.js'
import { bearingTo, haversineKm, projectX } from './geometry.js'
import { drawSky, drawSea, drawClouds, drawDeck, drawPalms, drawCompass, drawLandfall, horizonY } from './scene.js'
import { drawShip, shipAtPoint } from './ships.js'
import { makeFleet, stepFleet } from './sim.js'
import { fetchWeather, venezuelaVerdict } from './weather.js'
import { renderWeather, renderVerdict, initControls, showTooltip } from './ui.js'

const canvas = document.getElementById('view')
const ctx = canvas.getContext('2d')

let W = 0, H = 0, dpr = 1
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = canvas.clientWidth; H = canvas.clientHeight
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
window.addEventListener('resize', resize)
resize()

const fleet = USE_SIM ? makeFleet() : []
let ships = fleet // (milestone 4 will swap this for the live Map-derived array)
let wx = null
const controls = initControls(() => renderVerdict(wx, controls.manual ? controls.sightlineKm : null))

let hitRects = []
let mouse = { x: -1, y: -1 }
canvas.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY } })
canvas.addEventListener('mouseleave', () => { mouse = { x: -1, y: -1 } })

async function loadWeather() {
  try {
    wx = await fetchWeather()
    renderWeather(wx)
    if (!controls.manual) {
      controls.sightlineKm = Math.round(wx.sightlineKm)
      document.getElementById('sl').value = Math.min(200, controls.sightlineKm)
      document.getElementById('sl-val').textContent = `${controls.sightlineKm} km`
    }
    renderVerdict(wx, controls.manual ? controls.sightlineKm : null)
  } catch { renderWeather(null) }
}
loadWeather()
setInterval(() => { if (controls.liveWx) loadWeather() }, 10 * 60 * 1000)

let last = performance.now()
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t
  ctx.clearRect(0, 0, W, H)
  drawSky(ctx, W, H, t)
  drawClouds(ctx, W, H, t)
  drawSea(ctx, W, H, t)
  const effSl = controls.manual ? controls.sightlineKm : (wx ? wx.sightlineKm : null)
  if (effSl != null) drawLandfall(ctx, W, H, venezuelaVerdict(effSl).opacity)
  drawCompass(ctx, W, H)

  if (controls.drift && USE_SIM) stepFleet(fleet, dt)

  const hY = horizonY(W, H)
  const seaBottom = H - Math.max(26, H * 0.05) - 18
  const sightline = controls.sightlineKm
  hitRects = []
  // Far ships first so nearer ships draw on top.
  const drawable = ships.map(s => {
      const d = haversineKm(DECK.lat, DECK.lon, s.lat, s.lon)
      const b = bearingTo(DECK.lat, DECK.lon, s.lat, s.lon)
      s._bearing = b
      const x = projectX(b, DECK.viewBearing, DECK.fov, W)
      return { s, d, x }
    })
    .filter(o => o.x != null && o.d <= Math.min(FAR_KM, sightline))
    .sort((a, b) => b.d - a.d)
  for (const o of drawable) {
    const rect = drawShip(ctx, o.s, o.x, o.d, W, H, hY, seaBottom, EXAGGERATION, NEAR_KM, FAR_KM)
    if (rect) hitRects.push(rect)
  }

  drawDeck(ctx, W, H)
  drawPalms(ctx, W, H, t)

  const hit = mouse.x >= 0 ? shipAtPoint(hitRects, mouse.x, mouse.y) : null
  canvas.style.cursor = hit ? 'pointer' : 'default'
  showTooltip(hit, mouse.x, mouse.y)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
```

- [ ] **Step 2: Add the `horizonY` export check**

Confirm `public/js/scene.js` exports `horizonY` (added in Task 6). If not, ensure the
`export const horizonY` line is present.

- [ ] **Step 3: Run the full app and verify in the browser**

Run: `npm start`, open `http://localhost:5173`.
Expected:
- Sky/sun/clouds/sea/glitter/curved horizon render (Tasks 6).
- Travertine + glass + palms + compass strip frame the view (Task 7).
- ~9 ships sit at plausible bearings across the arc, nearer ones lower and larger,
  far ones tiny near the horizon and faded into haze; mid-range ships sit hull-down.
- Ships drift; the `⏸ Drift` button pauses/resumes; they recycle at the edges.
- Weather panel (top-left) shows live values; the verdict panel shows the Venezuela
  state; dragging the Sightline slider culls/reveals far ships and switches the
  verdict to "Experimenting…".
- A faint Venezuela ridge fades in near the horizon at ~196° when the sightline is
  high enough; dragging the slider up makes it appear, dragging down hides it.
- Hovering a ship shows the tooltip (name, flag, type, dest, distance, bearing +
  16-pt, speed, length, and "hull-down" when applicable); cursor turns to a pointer.
- No console errors.

- [ ] **Step 4: Run the whole test suite**

Run: `npm test`
Expected: all geometry/sim/weather/ships/static tests PASS.

- [ ] **Step 5: Commit**

```bash
git add public/js/main.js public/js/scene.js
git commit -m "feat: wire scene, ships, sim, weather, controls into the render loop"
```

- [ ] **Step 6: STOP — hand off for browser review**

Milestone 2 is complete. Do not start the AIS relay (milestone 3). Report to the
user that the view is ready to open and review.

---

## Self-review

**Spec coverage**
- Scene (sky/sun/clouds/sea/glitter/curved horizon) → Task 6. ✓
- Deck (travertine + frameless glass), corner palms, compass strip → Task 7. ✓
- Geometry (bearingTo, haversine, horizonKm, hull-down, projection, apparent size) → Task 3. ✓
- Vertical exaggeration with `EXAGGERATION` constant, honest bearing/size/hull-down → Tasks 3, 9, 12. ✓
- Ships: type silhouettes, haze fade, hover tooltip with all fields + hull-down note → Tasks 9, 11, 12. ✓
- Weather panel + sightline slider + drift/live-wx toggles → Tasks 5, 11, 12. ✓
- Koschmieder aerosol sightline + Venezuela verdict (hidden/barely/clear) → Task 10. ✓
- Faint Venezuela ghost ridge fading in with sightline confidence → `drawLandfall`
  in Task 7, wired in Task 12 (opacity driven by current/slider sightline). ✓
- Simulated fleet behind USE_SIM, accelerated drift, recycling → Task 8. ✓
- Zero-dep static server, `npm start`, ES modules, Node 20+ → Tasks 1, 4. ✓
- Scaffold: delete Java, package.json, dirs, .env(+example), .gitignore, git init/commit → Task 1. ✓
- Stop after milestone 2 → Task 12 Step 6. ✓

**Placeholder scan:** No TBD/TODO left in code steps; every code step shows complete code.

**Type consistency:** `drawShip(...)` signature matches its call in `main.js`;
`shipAtPoint(rects, x, y)` matches usage; `fetchWeather()` returns `{sightlineKm, verdict, …}`
consumed by `renderVerdict`/`main`; `horizonY(W,H)` exported by scene, used by main; sim
`stepFleet(fleet, dt)` matches. `config.js` exports (DECK, USE_SIM, EXAGGERATION, NEAR_KM,
FAR_KM, SUPERSTRUCTURE_M, SIZE_CAP_FRAC, BBOX, SIGHTLINE, PALETTE, LANDFALL) all referenced
consistently.

No outstanding gaps: every spec requirement maps to a task, including the Venezuela
ghost ridge (`drawLandfall`).
