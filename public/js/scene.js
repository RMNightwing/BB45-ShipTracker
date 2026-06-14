import { PALETTE, DECK, LANDFALL } from './config.js'
import { normalizeSigned, projectX } from './geometry.js'

const rgba = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`

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

// Optional palm artwork. If the file below exists we draw it in the corners;
// otherwise we fall back to the drawn clip-art palm. The source may be a JPEG
// on a white background — we knock the white out to transparency in-browser, so
// no transparent PNG or external tooling is needed.
const PALM_SRCS = ['img/PalmTree.png', 'img/PalmTree.jpg', 'img/palm.png']
const PALM_IMG_H = 0.34   // palm height as a fraction of the canvas (tunable)

let palmImg = null, palmState = 'idle'
function palmImage() {
  if (palmState === 'idle' && typeof Image !== 'undefined') { palmState = 'loading'; tryPalm(0) }
  return palmState === 'ready' ? palmImg : null
}
function tryPalm(i) {
  if (i >= PALM_SRCS.length) { palmState = 'missing'; return }
  const im = new Image()
  im.onload = () => { palmImg = keyOutWhite(im); palmState = 'ready' }
  im.onerror = () => tryPalm(i + 1)
  im.src = PALM_SRCS[i]
}

// Return an offscreen canvas of the image. If it already has a transparent
// background we use it as-is; otherwise we knock its near-white background out
// to transparency (soft edge), so clip-art on white composites cleanly.
function keyOutWhite(img) {
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  const cx = c.getContext('2d')
  cx.drawImage(img, 0, 0)
  const d = cx.getImageData(0, 0, c.width, c.height), p = d.data
  if (p[3] < 10) return c   // top-left already transparent -> pre-keyed art
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2]
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b)
    if (mn > 225 && mx - mn < 22) p[i + 3] = mn >= 245 ? 0 : Math.round((245 - mn) / 20 * 255)
  }
  cx.putImageData(d, 0, 0)
  return c
}

function drawPalmImage(ctx, W, H, img, mirror) {
  const h = H * PALM_IMG_H
  const w = h * (img.width / img.height)
  ctx.save()
  if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1) }
  ctx.drawImage(img, -W * 0.015, H - h + H * 0.015, w, h) // base tucked into the corner
  ctx.restore()
}

// Palm silhouettes nestled into each bottom corner (image if available, else drawn).
export function drawPalms(ctx, W, H, t) {
  const img = palmImage()
  if (img) { drawPalmImage(ctx, W, H, img, false); drawPalmImage(ctx, W, H, img, true) }
  else { drawPalm(ctx, W, H, t, false); drawPalm(ctx, W, H, t, true) }
}

function drawPalm(ctx, W, H, t, mirror) {
  ctx.save()
  if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1) }
  ctx.fillStyle = 'rgba(18,28,26,0.62)'

  // Crown low in the corner so the whole tree sits in the bottom ~25%.
  const cx = W * 0.075, cy = H * 0.75
  const baseX = -W * 0.015, baseY = H * 1.02
  const tw = Math.max(5, W * 0.011)            // trunk half-width at the base

  // Curved tapered trunk from the off-frame corner up to the crown.
  ctx.beginPath()
  ctx.moveTo(baseX - tw, baseY)
  ctx.quadraticCurveTo(W * 0.015, H * 0.92, cx - tw * 0.35, cy)
  ctx.lineTo(cx + tw * 0.35, cy)
  ctx.quadraticCurveTo(W * 0.055, H * 0.92, baseX + tw, baseY)
  ctx.closePath(); ctx.fill()

  // Coconut cluster at the crown.
  for (const [dx, dy] of [[-0.35, 0.15], [0.35, 0.2], [0, 0.45]]) {
    ctx.beginPath()
    ctx.arc(cx + dx * W * 0.018, cy + dy * H * 0.02, Math.max(2.5, W * 0.0055), 0, Math.PI * 2)
    ctx.fill()
  }

  // Fronds: filled leaves fanning across the top, tips drooping.
  const N = 8
  const base = H * (0.11 + 0.015 * Math.sin(t / 4000))   // gentle breathing
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1)                                 // 0..1 left -> right
    const ang = -Math.PI * (0.94 - f * 0.88)              // ~ -169 .. -11 deg
    const sway = 0.04 * Math.sin(t / 1100 + i)
    const reach = base * (0.78 + 0.22 * Math.sin(f * Math.PI)) // longer in the middle
    frond(ctx, cx, cy, ang + sway, reach, W * 0.013)
  }
  ctx.restore()
}

// One filled palm leaf: a pointed lens from (cx,cy) out to a drooping tip.
function frond(ctx, cx, cy, ang, len, width) {
  const ca = Math.cos(ang), sa = Math.sin(ang)
  const tipX = cx + ca * len
  const tipY = cy + sa * len + len * 0.3       // gravity droop at the tip
  const mx = cx + ca * len * 0.5, my = cy + sa * len * 0.5
  const nx = -sa, ny = ca                        // unit normal to the spine
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.quadraticCurveTo(mx + nx * width, my + ny * width, tipX, tipY)
  ctx.quadraticCurveTo(mx - nx * width, my - ny * width, cx, cy)
  ctx.fill()
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
