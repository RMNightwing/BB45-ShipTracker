import { PALETTE, DECK, LANDFALL } from './config.js'
import { normalizeSigned, projectX } from './geometry.js'

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
