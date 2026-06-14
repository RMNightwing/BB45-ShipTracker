# Dynamic Sky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deck's sky live — sun, sky color, stars, moon, and clouds all follow the real Curaçao clock, the true sun position, and the real wind.

**Architecture:** A new pure module `public/js/sky.js` does all astronomy and color math (unit-tested under Node). `scene.js` draw functions take an `env` object instead of the fixed palette. `main.js` computes `env` from `new Date()` + the DECK coordinates + the already-fetched weather each frame and passes it to the scene. No new network call.

**Tech Stack:** Vanilla JS, HTML Canvas, native ES modules, `node --test`. Spec: `docs/superpowers/specs/2026-06-13-dynamic-sky-design.md`.

---

## File Structure

- **Create** `public/js/sky.js` — `sunPosition`, `moonPhase`, `skyState`, `projectCelestial` (pure; imports `SKY` from config, `projectX` from geometry).
- **Create** `public/js/sky.test.js` — Node tests for the four pure functions.
- **Modify** `public/js/config.js` — add the `SKY` elevation-keyframe palette table.
- **Modify** `public/js/scene.js` — `drawSky`/`drawSea`/`drawClouds` take `env`; add `drawStars` and `drawMoon`.
- **Modify** `public/js/main.js` — assemble `env` per frame and pass it to the scene; reorder draws so stars/moon sit behind clouds.

Convention reminders: 2-space indent, camelCase, minimal comments. Pure functions take inputs explicitly (a `date` is passed in, never read from a clock inside) so they test deterministically. Visual draw code is verified by eye in the browser and by `node --check` + `npm test` (no regressions), not by unit tests — consistent with the rest of the project.

---

## Task 1: Solar position (`sunPosition`)

**Files:**
- Create: `public/js/sky.js`
- Test: `public/js/sky.test.js`

- [ ] **Step 1: Write the failing test**

Create `public/js/sky.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sunPosition } from './sky.js'

const LAT = 12.135778, LON = -68.989280 // the deck

test('sunPosition: sun is below the horizon at 1am AST', () => {
  const { elevation } = sunPosition(new Date('2026-03-20T05:00:00Z'), LAT, LON) // 01:00 AST
  assert.ok(elevation < 0, `elevation ${elevation}`)
})

test('sunPosition: sun is high near solar noon', () => {
  const { elevation } = sunPosition(new Date('2026-03-20T16:30:00Z'), LAT, LON) // ~12:30 AST
  assert.ok(elevation > 40, `elevation ${elevation}`)
})

test('sunPosition: morning sun is in the eastern half of the compass', () => {
  const { azimuth, elevation } = sunPosition(new Date('2026-03-20T13:00:00Z'), LAT, LON) // 09:00 AST
  assert.ok(elevation > 0, `elevation ${elevation}`)
  assert.ok(azimuth > 60 && azimuth < 170, `azimuth ${azimuth}`)
})

test('sunPosition: late-afternoon sun is in the western half', () => {
  const { azimuth } = sunPosition(new Date('2026-03-20T21:00:00Z'), LAT, LON) // 17:00 AST
  assert.ok(azimuth > 200 && azimuth < 300, `azimuth ${azimuth}`)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/js/sky.test.js`
Expected: FAIL — cannot import `sunPosition` (module/function missing).

- [ ] **Step 3: Write the minimal implementation**

Create `public/js/sky.js`:

```js
// Astronomy + sky-color math for the dynamic sky. Pure (no DOM, no clock read):
// every function takes its inputs explicitly so it unit-tests under Node.
// Solar/lunar math adapted from the well-known SunCalc formulas.

const rad = Math.PI / 180
const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545
const e = rad * 23.4397 // obliquity of the ecliptic

const toDays = date => date.valueOf() / dayMs - 0.5 + J1970 - J2000
const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l))
const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l))
const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw

function sunCoords(d) {
  const M = rad * (357.5291 + 0.98560028 * d)                                  // mean anomaly
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + rad * 102.9372 + Math.PI                                   // ecliptic longitude
  return { dec: declination(L, 0), ra: rightAscension(L, 0) }
}

// Real solar position. azimuth in compass degrees (0=N, 90=E, 180=S, 270=W),
// elevation in degrees above the horizon.
export function sunPosition(date, lat, lon) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(date)
  const c = sunCoords(d)
  const H = siderealTime(d, lw) - c.ra
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi))
  const el = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H))
  return { azimuth: (az / rad + 180 + 360) % 360, elevation: el / rad }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test public/js/sky.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add public/js/sky.js public/js/sky.test.js
git commit -m "feat: real solar position (azimuth + elevation), tested"
```

---

## Task 2: Moon phase (`moonPhase`)

**Files:**
- Modify: `public/js/sky.js`
- Test: `public/js/sky.test.js`

- [ ] **Step 1: Write the failing test**

Append to `public/js/sky.test.js`:

```js
import { moonPhase } from './sky.js'

test('moonPhase: ~new moon reads dark and waxing', () => {
  const m = moonPhase(new Date('2000-01-06T18:14:00Z')) // a known new moon
  assert.ok(m.fraction < 0.05, `fraction ${m.fraction}`)
  assert.equal(m.waxing, true)
})

test('moonPhase: ~full moon reads fully lit', () => {
  const m = moonPhase(new Date('2000-01-21T04:40:00Z')) // a known full moon (lunar eclipse)
  assert.ok(m.fraction > 0.93, `fraction ${m.fraction}`)
})

test('moonPhase: a week after full is waning', () => {
  const m = moonPhase(new Date('2000-01-28T00:00:00Z'))
  assert.equal(m.waxing, false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/js/sky.test.js`
Expected: FAIL — `moonPhase` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `public/js/sky.js`:

```js
const SYNODIC = 29.530588853
const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14) / dayMs // days of a known new moon

// Approximate lunar phase. `fraction` is the illuminated fraction (0=new, 1=full);
// `waxing` is true on the way to full (lit limb on one side vs the other). Good to
// ~1 day — enough to draw the right crescent/gibbous.
export function moonPhase(date) {
  const days = date.valueOf() / dayMs - KNOWN_NEW
  const phase = (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC // 0=new .. 0.5=full
  const fraction = (1 - Math.cos(2 * Math.PI * phase)) / 2
  return { phase, fraction, waxing: phase < 0.5 }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test public/js/sky.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add public/js/sky.js public/js/sky.test.js
git commit -m "feat: approximate moon phase, tested"
```

---

## Task 3: Sky palette keyframes + `skyState`

**Files:**
- Modify: `public/js/config.js`
- Modify: `public/js/sky.js`
- Test: `public/js/sky.test.js`

- [ ] **Step 1: Add the keyframe table to config.js**

Append to `public/js/config.js`:

```js
// Sky palette keyframes by sun elevation (deg), high → low. Colours are [r,g,b];
// ambient 0..1 dims the sea/clouds; starAlpha 0..1 fades the night sky in.
// skyState() in sky.js interpolates between adjacent rows. Tunable by eye.
export const SKY = [
  { el:  12, skyTop:[127,182,230], skyBottom:[220,234,243], seaTop:[188,214,223], seaBottom:[63,125,146], horizon:[44,91,107], sunTint:[255,248,228], ambient:1.00, starAlpha:0    },
  { el:   2, skyTop:[120,150,200], skyBottom:[255,222,180], seaTop:[150,170,180], seaBottom:[50,95,120],  horizon:[60,80,100], sunTint:[255,226,180], ambient:0.85, starAlpha:0    },
  { el:  -4, skyTop:[40,50,95],    skyBottom:[235,140,90],  seaTop:[60,70,95],    seaBottom:[28,45,70],   horizon:[45,55,80],  sunTint:[255,170,110], ambient:0.45, starAlpha:0.45 },
  { el: -10, skyTop:[18,22,48],    skyBottom:[40,45,80],    seaTop:[20,28,45],    seaBottom:[10,16,30],   horizon:[22,28,48],  sunTint:[120,130,170], ambient:0.18, starAlpha:0.90 },
  { el: -18, skyTop:[8,10,24],     skyBottom:[14,18,38],    seaTop:[8,12,22],     seaBottom:[4,7,16],     horizon:[12,16,30],  sunTint:[80,90,130],   ambient:0.10, starAlpha:1    }
]
```

- [ ] **Step 2: Write the failing test**

Append to `public/js/sky.test.js`:

```js
import { skyState } from './sky.js'

test('skyState: full day has no stars and full ambient, returns css colours', () => {
  const s = skyState(60)
  assert.equal(s.starAlpha, 0)
  assert.ok(s.ambient > 0.95)
  assert.match(s.skyTop, /^rgb\(/)
  assert.ok(Array.isArray(s.sunTint)) // sunTint stays [r,g,b] for alpha compositing
})

test('skyState: deep night is fully starred and dim', () => {
  const s = skyState(-30)
  assert.equal(s.starAlpha, 1)
  assert.ok(s.ambient < 0.15)
})

test('skyState: stars grow as the sun sinks', () => {
  assert.ok(skyState(-12).starAlpha > skyState(0).starAlpha)
})

test('skyState: interpolates between keyframes', () => {
  const s = skyState(7) // between the +12 and +2 rows
  assert.ok(s.ambient > 0.85 && s.ambient < 1)
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test public/js/sky.test.js`
Expected: FAIL — `skyState` is not exported.

- [ ] **Step 4: Write the minimal implementation**

Add the import at the top of `public/js/sky.js` (below the opening comment):

```js
import { SKY } from './config.js'
```

Append to `public/js/sky.js`:

```js
const lerp = (a, b, u) => a + (b - a) * u
const css = c => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
const CSS_CH = ['skyTop', 'skyBottom', 'seaTop', 'seaBottom', 'horizon']

// Interpolated sky environment for a given sun elevation (deg). Colour channels
// come back as css 'rgb(...)' strings; sunTint stays an [r,g,b] array so callers
// can build rgba glows. ambient/starAlpha are 0..1.
export function skyState(elevationDeg) {
  let hi = SKY[0], lo = SKY[SKY.length - 1]
  if (elevationDeg >= hi.el) lo = hi
  else if (elevationDeg <= lo.el) hi = lo
  else {
    for (let i = 0; i < SKY.length - 1; i++) {
      if (elevationDeg <= SKY[i].el && elevationDeg >= SKY[i + 1].el) { hi = SKY[i]; lo = SKY[i + 1]; break }
    }
  }
  const span = hi.el - lo.el
  const u = span === 0 ? 0 : (hi.el - elevationDeg) / span // 0 at hi, 1 at lo
  const out = {}
  for (const ch of CSS_CH) out[ch] = css(hi[ch].map((v, j) => lerp(v, lo[ch][j], u)))
  out.sunTint = hi.sunTint.map((v, j) => lerp(v, lo.sunTint[j], u))
  out.ambient = lerp(hi.ambient, lo.ambient, u)
  out.starAlpha = lerp(hi.starAlpha, lo.starAlpha, u)
  return out
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test public/js/sky.test.js`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add public/js/config.js public/js/sky.js public/js/sky.test.js
git commit -m "feat: elevation-keyframe sky palette (skyState), tested"
```

---

## Task 4: Project celestial body to screen (`projectCelestial`)

**Files:**
- Modify: `public/js/sky.js`
- Test: `public/js/sky.test.js`

- [ ] **Step 1: Write the failing test**

Append to `public/js/sky.test.js`:

```js
import { projectCelestial } from './sky.js'

// args: (azimuth, elevation, viewBearing, fov, W, H, horizonY)
test('projectCelestial: a body at view-centre, well up, sits centred above the horizon', () => {
  const p = projectCelestial(223, 25, 223, 156, 1000, 800, 336)
  assert.equal(p.visible, true)
  assert.ok(Math.abs(p.x - 500) < 1, `x ${p.x}`)
  assert.ok(p.y < 336, `y ${p.y}`)
})

test('projectCelestial: below the horizon is not visible', () => {
  assert.equal(projectCelestial(223, -5, 223, 156, 1000, 800, 336).visible, false)
})

test('projectCelestial: outside the view arc is not visible', () => {
  assert.equal(projectCelestial(20, 30, 223, 156, 1000, 800, 336).visible, false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test public/js/sky.test.js`
Expected: FAIL — `projectCelestial` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Add the import at the top of `public/js/sky.js` (with the other imports):

```js
import { projectX } from './geometry.js'
```

Append to `public/js/sky.js`:

```js
const SKY_VTOP = 50 // elevation (deg) that maps to the top of the sky band

// Screen position for a celestial body. x from true azimuth (exact, via projectX);
// y from a stylized elevation map (0° at the horizon, ~SKY_VTOP° near the top).
// visible is false below the horizon or outside the view arc.
export function projectCelestial(azimuth, elevation, viewBearing, fov, W, H, horizonY) {
  const x = projectX(azimuth, viewBearing, fov, W)
  const up = Math.max(0, Math.min(1, elevation / SKY_VTOP))
  const y = horizonY - up * horizonY * 0.92
  return { x: x == null ? null : x, y, visible: x != null && elevation > -1 }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test public/js/sky.test.js`
Expected: PASS (14 tests). Then run the full suite — nothing else should break:

Run: `npm test`
Expected: PASS (existing 51 + 14 new = 65).

- [ ] **Step 5: Commit**

```bash
git add public/js/sky.js public/js/sky.test.js
git commit -m "feat: project sun/moon to screen by azimuth + elevation, tested"
```

---

## Task 5: `drawSky` consumes the environment

**Files:**
- Modify: `public/js/scene.js` (`drawSky`, add an `rgba` helper)

Visual task — verify by `node --check` + `npm test` (no regressions) and a browser eyeball; no unit test for canvas drawing.

- [ ] **Step 1: Add an rgba helper near the top of scene.js**

After the existing imports in `public/js/scene.js`, add:

```js
const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`
```

- [ ] **Step 2: Replace `drawSky`**

Replace the whole `drawSky` function with:

```js
export function drawSky(ctx, W, H, t, env) {
  const y = horizonY(W, H)
  const g = ctx.createLinearGradient(0, 0, 0, y)
  g.addColorStop(0, env.skyTop); g.addColorStop(1, env.skyBottom)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, y + 2)

  if (env.sun.visible) {
    const sx = env.sun.x, sy = env.sun.y
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.22)
    glow.addColorStop(0, rgba(env.sunTint, 0.95))
    glow.addColorStop(0.4, rgba(env.sunTint, 0.30))
    glow.addColorStop(1, rgba(env.sunTint, 0))
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, y + 2)
    ctx.fillStyle = rgba(env.sunTint, 0.9)
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(6, H * 0.012), 0, Math.PI * 2); ctx.fill()
  }
}
```

- [ ] **Step 3: Verify it parses and tests still pass**

Run: `node --check public/js/scene.js && npm test`
Expected: scene parses; `npm test` PASS (65). (The app won't render correctly until `main.js` passes `env` in Task 9 — that's expected; we're committing per-unit.)

- [ ] **Step 4: Commit**

```bash
git add public/js/scene.js
git commit -m "feat: drawSky takes the sky env (palette + positioned sun)"
```

---

## Task 6: `drawSea` darkens with ambient; glitter follows the sun

**Files:**
- Modify: `public/js/scene.js` (`drawSea`)

- [ ] **Step 1: Replace `drawSea`**

Replace the whole `drawSea` function with:

```js
export function drawSea(ctx, W, H, t, env) {
  const y = horizonY(W, H)
  const g = ctx.createLinearGradient(0, y, 0, H)
  g.addColorStop(0, env.seaTop); g.addColorStop(1, env.seaBottom)
  ctx.save()
  horizonPath(ctx, W, H); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip()
  ctx.fillStyle = g; ctx.fillRect(0, y - curveDip(W), W, H)

  // Sun-glitter only while the sun is up and in view, descending from its real x.
  if (env.sun.visible && env.sun.up) {
    const cx = env.sun.x
    for (let i = 0; i < 60; i++) {
      const fy = y + (H - y) * (i / 60)
      const spread = 6 + (i / 60) * W * 0.10
      const a = 0.12 * env.ambient * (1 - i / 60) * (0.6 + 0.4 * Math.sin(t / 400 + i))
      ctx.fillStyle = `rgba(255,250,235,${a.toFixed(3)})`
      ctx.fillRect(cx - spread, fy, spread * 2, 2)
    }
  }
  ctx.restore()

  ctx.strokeStyle = env.horizon; ctx.lineWidth = 1; ctx.globalAlpha = 0.5
  horizonPath(ctx, W, H); ctx.stroke(); ctx.globalAlpha = 1
}
```

- [ ] **Step 2: Verify it parses and tests still pass**

Run: `node --check public/js/scene.js && npm test`
Expected: PASS (65).

- [ ] **Step 3: Commit**

```bash
git add public/js/scene.js
git commit -m "feat: drawSea darkens with ambient, glitter tracks the sun"
```

---

## Task 7: Stars and the moon

**Files:**
- Modify: `public/js/scene.js` (add `drawStars`, `drawMoon`)

- [ ] **Step 1: Add `drawStars` and `drawMoon`**

Append to `public/js/scene.js`:

```js
// A fixed decorative starfield, generated once. x/y are fractions; y is biased to
// the upper sky. The whole field fades in/out with env.starAlpha.
const STARS = Array.from({ length: 120 }, () => ({
  x: Math.random(), y: Math.random() * 0.4, r: 0.5 + Math.random() * 1.2, p: Math.random() * 6.28
}))

export function drawStars(ctx, W, H, t, env) {
  if (env.starAlpha <= 0.01) return
  const y = horizonY(W, H)
  ctx.save()
  for (const s of STARS) {
    const tw = 0.6 + 0.4 * Math.sin(t / 600 + s.p * 10)            // twinkle
    const a = env.starAlpha * tw * (0.55 + 0.45 * (1 - s.y / 0.4)) // brighter near zenith
    ctx.fillStyle = `rgba(255,255,245,${a.toFixed(3)})`
    ctx.beginPath(); ctx.arc(s.x * W, s.y * y, s.r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// Moon at tonight's real phase, drawn on an offscreen canvas (so the phase carve
// doesn't punch a hole in the sky behind it), then composited with the night fade.
let moonCanvas = null
export function drawMoon(ctx, W, H, t, env) {
  if (env.starAlpha <= 0.05 || !env.moon) return
  const { x, y, fraction, waxing } = env.moon
  const r = Math.max(10, H * 0.022)
  const size = Math.ceil(r * 2 + 4), cx = size / 2
  if (!moonCanvas) moonCanvas = document.createElement('canvas')
  moonCanvas.width = size; moonCanvas.height = size
  const m = moonCanvas.getContext('2d')
  m.clearRect(0, 0, size, size)
  m.fillStyle = 'rgba(245,245,228,1)'
  m.beginPath(); m.arc(cx, cx, r, 0, Math.PI * 2); m.fill()
  if (fraction < 0.98) {
    const offset = (waxing ? -1 : 1) * r * 2 * (1 - fraction) // slide a cut-out across the dark limb
    m.globalCompositeOperation = 'destination-out'
    m.beginPath(); m.arc(cx + offset, cx, r, 0, Math.PI * 2); m.fill()
  }
  ctx.save()
  ctx.globalAlpha = env.starAlpha
  ctx.drawImage(moonCanvas, x - cx, y - cx)
  ctx.restore()
}
```

- [ ] **Step 2: Verify it parses and tests still pass**

Run: `node --check public/js/scene.js && npm test`
Expected: PASS (65).

- [ ] **Step 3: Commit**

```bash
git add public/js/scene.js
git commit -m "feat: night starfield + real-phase moon"
```

---

## Task 8: Wind-driven clouds

**Files:**
- Modify: `public/js/scene.js` (`drawClouds`)

- [ ] **Step 1: Replace `drawClouds`**

`scene.js` already imports `DECK`. Replace the whole `drawClouds` function with:

```js
const mod = (a, n) => ((a % n) + n) % n

export function drawClouds(ctx, W, H, t, env) {
  const y = horizonY(W, H)
  const pct = Math.max(0, Math.min(100, env.cloudPct ?? 40))
  const n = Math.round(2 + (pct / 100) * 6)                 // 2..8 clouds
  const baseAlpha = 0.08 + (pct / 100) * 0.22               // wispy..dense
  const amb = env.ambient ?? 1
  const tint = [40 + 215 * amb, 45 + 210 * amb, 70 + 185 * amb] // dark at night, white by day
  // Drift from the crosswind component relative to the view bearing.
  const rel = (env.wind.dir - DECK.viewBearing) * Math.PI / 180
  const drift = Math.sin(rel) * (env.wind.kn || 5)
  ctx.save()
  for (let i = 0; i < n; i++) {
    const speed = drift * (0.6 + i * 0.12) * 0.4
    const cx = mod(t / 1000 * speed + i * 320, W + 360) - 180
    const cy = y * (0.22 + 0.13 * (i % 4))
    const s = 50 + (i % 4) * 18
    ctx.fillStyle = rgba(tint, baseAlpha - (i % 4) * 0.015)
    for (const [ox, oy, r] of [[-s, 6, s * 0.7], [0, 0, s], [s, 8, s * 0.6], [s * 0.4, 12, s * 0.8]]) {
      ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}
```

- [ ] **Step 2: Verify it parses and tests still pass**

Run: `node --check public/js/scene.js && npm test`
Expected: PASS (65).

- [ ] **Step 3: Commit**

```bash
git add public/js/scene.js
git commit -m "feat: clouds drift on real wind, density from cloud cover"
```

---

## Task 9: Assemble `env` in `main.js` and wire the scene

**Files:**
- Modify: `public/js/main.js`

- [ ] **Step 1: Add imports**

In `public/js/main.js`, update the scene and add sky imports. Change the scene import line to include `drawStars`, `drawMoon`, and add a new line for `sky.js`:

```js
import { drawSky, drawSea, drawClouds, drawDeck, drawPalms, drawCompass, drawLandfall, horizonY, drawStars, drawMoon } from './scene.js'
import { sunPosition, moonPhase, skyState, projectCelestial } from './sky.js'
```

- [ ] **Step 2: Add a stylized moon-arc helper**

Near the top of `public/js/main.js` (after the imports), add:

```js
// Stylized slow arc for the moon across the night sky (position is decorative;
// only its phase is real).
function moonArc(date, W, hY) {
  const h = date.getHours() + date.getMinutes() / 60
  const u = ((h + 12) % 24) / 24
  const arch = Math.sin(Math.PI * u)
  return { x: W * (0.15 + 0.7 * u), y: hY - arch * hY * 0.7 - hY * 0.05 }
}
```

- [ ] **Step 3: Build `env` and pass it into the scene**

In the `frame(t)` function, replace this block:

```js
  ctx.clearRect(0, 0, W, H)
  drawSky(ctx, W, H, t)
  drawClouds(ctx, W, H, t)
  drawSea(ctx, W, H, t)
  const effSl = controls.manual ? controls.sightlineKm : (wx ? wx.sightlineKm : null)
  if (effSl != null) drawLandfall(ctx, W, H, venezuelaVerdict(effSl).opacity)
  drawCompass(ctx, W, H)
```

with:

```js
  ctx.clearRect(0, 0, W, H)
  const hY0 = horizonY(W, H)
  const now = new Date()
  const sp = sunPosition(now, DECK.lat, DECK.lon)
  const sproj = projectCelestial(sp.azimuth, sp.elevation, DECK.viewBearing, DECK.fov, W, H, hY0)
  const mp = moonPhase(now)
  const marc = moonArc(now, W, hY0)
  const env = {
    ...skyState(sp.elevation),
    sun: { x: sproj.x == null ? W / 2 : sproj.x, y: sproj.y, visible: sproj.visible, up: sp.elevation > 0 },
    moon: { x: marc.x, y: marc.y, fraction: mp.fraction, waxing: mp.waxing },
    wind: { dir: wx?.windDir ?? 90, kn: wx?.windKn ?? 6 },
    cloudPct: wx?.cloud ?? 40
  }

  drawSky(ctx, W, H, t, env)
  drawStars(ctx, W, H, t, env)
  drawMoon(ctx, W, H, t, env)
  drawClouds(ctx, W, H, t, env)
  drawSea(ctx, W, H, t, env)
  const effSl = controls.manual ? controls.sightlineKm : (wx ? wx.sightlineKm : null)
  if (effSl != null) drawLandfall(ctx, W, H, venezuelaVerdict(effSl).opacity)
  drawCompass(ctx, W, H)
```

- [ ] **Step 4: Verify it parses and the full suite passes**

Run: `node --check public/js/main.js && npm test`
Expected: `main.js` parses; `npm test` PASS (65).

- [ ] **Step 5: Browser check (host)**

Run `npm start`, open `http://localhost:5173`, and confirm:
- The sky color matches the current time of day (and the sun, if its bearing is within the 145°–301° view, sits at the right place — e.g. a real sunset on the right in the evening).
- Clouds drift in a direction consistent with the wind panel.
- If it's currently night in Curaçao, stars appear and the moon shows roughly the right phase.

To preview other times without waiting, temporarily change `const now = new Date()` to a fixed date (e.g. `new Date('2026-06-14T22:30:00Z')` for night), eyeball, then revert.

- [ ] **Step 6: Commit**

```bash
git add public/js/main.js
git commit -m "feat: drive the scene from real sun, clock, and wind (dynamic sky)"
```

---

## Self-review notes (already reconciled)

- **Spec coverage:** real-time basis (Task 9 `new Date()`), true sun azimuth/elevation (Task 1 + `projectCelestial` Task 4), palette by elevation (Task 3), stars + real-phase moon (Task 7, phase from Task 2), wind-driven clouds + cloud-cover density (Task 8), no new network call (weather reused in Task 9). Waves intentionally absent (next milestone).
- **Type consistency:** `env` carries `skyTop/skyBottom/seaTop/seaBottom/horizon` (css strings), `sunTint` ([r,g,b] array), `ambient`, `starAlpha`, `sun:{x,y,visible,up}`, `moon:{x,y,fraction,waxing}`, `wind:{dir,kn}`, `cloudPct` — produced in Task 9, consumed in Tasks 5–8 exactly as named.
- **Out of scope:** waves, rain/fog from weather codes, true constellations / true lunar position.
