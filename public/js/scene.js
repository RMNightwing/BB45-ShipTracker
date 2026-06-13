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
