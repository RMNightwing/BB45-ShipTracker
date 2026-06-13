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
