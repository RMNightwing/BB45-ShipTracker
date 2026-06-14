
// Grow a hit box to at least min×min around its centre, so a ship only a few
// pixels wide stays easy to hover. The drawn silhouette is unaffected — this
// only enlarges the invisible interactive target.
export function padRect(x, y, w, h, min) {
  const pw = Math.max(w, min), ph = Math.max(h, min)
  return { x: x + w / 2 - pw / 2, y: y + h / 2 - ph / 2, w: pw, h: ph }
}

// Topmost (last-drawn) ship whose hit box contains the point, else null.
export function shipAtPoint(rects, px, py) {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i]
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r
  }
  return null
}

// 0..1 "how much night": 0 in full daylight, 1 deep night. Driven by the sky's
// ambient (1 day → ~0.1 night), so dusk interpolates. Pure + exported for tests.
export function nightLift(ambient) {
  const a = ambient == null ? 1 : ambient
  return Math.max(0, Math.min(1, (0.6 - a) / (0.6 - 0.12)))
}

// Detail level-of-detail: 0 for a small/distant ship (flat silhouette), ramping
// to 1 once it's drawn large enough that internal detail reads. Pure, exported.
export function lodDetail(widthPx) {
  return Math.max(0, Math.min(1, (widthPx - 26) / 90))
}

// Build the working palette for the ambient light. Dark hull lifts toward a
// moonlit mid-tone so it stands off the near-black night sea; bright white decks
// settle toward the same mid-tone — i.e. contrast compresses at night. The rim
// flips from a faint dark edge by day to a light "moonlit" edge at night.
const SHIP = {
  hull: '#1e3a44', deck: '#2c4d59', white: '#dfe7ea', glass: '#9fb4bd',
  accent: '#b9654a', slate: '#56707c',
  boxes: ['#7c4a3a', '#3f6e72', '#9c8350', '#56707c', '#6b4a52', '#3f5a6e']
}
const MOON_MID = '#6f8893'
export function shipPalette(ambient) {
  const lift = nightLift(ambient)
  const m = c => mix(c, MOON_MID, lift * 0.6)
  const rim = lift > 0.4
    ? `rgba(206,222,229,${(0.5 * lift).toFixed(2)})`
    : `rgba(12,26,33,${(0.4 * (1 - lift)).toFixed(2)})`
  return {
    hull: m(SHIP.hull), deck: m(SHIP.deck), white: m(SHIP.white), glass: m(SHIP.glass),
    accent: m(SHIP.accent), slate: m(SHIP.slate), boxes: SHIP.boxes.map(m), rim
  }
}
function rim(ctx, P) { ctx.save(); ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.stroke(); ctx.restore() }

// Per-type painters draw a unit ship into a box: x 0..w, waterline at y=0, UP is
// negative. det 0..1 detail; P resolved palette. Differ by proportion + signature.
export const SILHOUETTES = {
  container(ctx, w, det, P) {
    const hf = Math.max(2, w * 0.085)
    ctx.beginPath(); ctx.moveTo(0, -hf); ctx.lineTo(w * 0.97, -hf)
    ctx.lineTo(w, -hf * 0.2); ctx.lineTo(w, 0); ctx.lineTo(w * 0.03, 0); ctx.lineTo(0, -hf * 0.5); ctx.closePath()
    ctx.fillStyle = P.hull; ctx.fill(); rim(ctx, P)
    const bays = 8, gap = w * 0.78 / bays
    for (let i = 0; i < bays; i++) {
      const bx = w * 0.03 + i * gap, stack = 3 + ((i * 5 + 2) % 3)
      for (let r = 0; r < stack; r++) {
        ctx.fillStyle = det > 0.35 ? P.boxes[(i + r) % P.boxes.length] : P.hull
        ctx.fillRect(bx, -hf - (r + 1) * w * 0.05, gap * 0.86, w * 0.046)
      }
    }
    ctx.beginPath(); ctx.rect(w * 0.85, -hf - w * 0.18, w * 0.11, w * 0.18)
    ctx.fillStyle = det > 0.2 ? P.deck : P.hull; ctx.fill(); rim(ctx, P)
    ctx.fillStyle = det > 0.2 ? P.accent : P.hull; ctx.fillRect(w * 0.885, -hf - w * 0.25, w * 0.045, w * 0.075)
  },
  tanker(ctx, w, det, P) {
    const hf = Math.max(2, w * 0.075)
    ctx.beginPath(); ctx.moveTo(0, -hf * 0.7); ctx.lineTo(w * 0.97, -hf); ctx.lineTo(w, -hf * 0.35)
    ctx.lineTo(w, 0); ctx.lineTo(w * 0.015, 0); ctx.closePath(); ctx.fillStyle = P.hull; ctx.fill(); rim(ctx, P)
    if (det > 0.25) {
      ctx.fillStyle = P.deck; ctx.fillRect(w * 0.04, -hf - w * 0.01, w * 0.80, w * 0.01)
      ctx.fillStyle = P.accent; ctx.fillRect(w * 0.42, -hf - w * 0.045, w * 0.06, w * 0.045)
      for (const px of [0.12, 0.30, 0.55, 0.72]) ctx.fillRect(w * px, -hf - w * 0.04, w * 0.01, w * 0.04)
    }
    ctx.beginPath(); ctx.rect(w * 0.80, -hf - w * 0.19, w * 0.14, w * 0.19)
    ctx.fillStyle = det > 0.2 ? P.deck : P.hull; ctx.fill(); rim(ctx, P)
    ctx.fillStyle = det > 0.2 ? P.slate : P.hull; ctx.fillRect(w * 0.84, -hf - w * 0.26, w * 0.05, w * 0.07)
  },
  bulk(ctx, w, det, P) {
    const hf = Math.max(2, w * 0.09)
    ctx.beginPath(); ctx.moveTo(0, -hf * 0.55); ctx.lineTo(w * 0.97, -hf); ctx.lineTo(w, -hf * 0.25)
    ctx.lineTo(w, 0); ctx.lineTo(w * 0.02, 0); ctx.closePath(); ctx.fillStyle = P.hull; ctx.fill(); rim(ctx, P)
    if (det > 0.25) { ctx.fillStyle = P.deck; for (let i = 0; i < 4; i++) ctx.fillRect(w * (0.08 + i * 0.17), -hf - w * 0.03, w * 0.11, w * 0.03) }
    ctx.strokeStyle = det > 0.2 ? P.slate : P.hull; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(1.2, w * 0.012)
    for (let i = 0; i < 4; i++) {
      const cx = w * (0.16 + i * 0.17)
      ctx.fillRect(cx - w * 0.013, -hf - w * 0.11, w * 0.026, w * 0.11)
      ctx.beginPath(); ctx.moveTo(cx, -hf - w * 0.11); ctx.lineTo(cx + w * 0.11, -hf - w * 0.17); ctx.stroke()
    }
    ctx.beginPath(); ctx.rect(w * 0.85, -hf - w * 0.14, w * 0.11, w * 0.14)
    ctx.fillStyle = det > 0.2 ? P.deck : P.hull; ctx.fill(); rim(ctx, P)
  },
  cruise(ctx, w, det, P) {
    const hf = Math.max(2, w * 0.06)
    ctx.beginPath(); ctx.moveTo(0, -hf * 0.2); ctx.lineTo(w * 0.97, -hf); ctx.lineTo(w, -hf * 0.6)
    ctx.lineTo(w * 0.985, 0); ctx.lineTo(w * 0.04, 0); ctx.closePath(); ctx.fillStyle = P.hull; ctx.fill(); rim(ctx, P)
    const sh = w * 0.40
    ctx.beginPath(); ctx.moveTo(w * 0.05, -hf); ctx.lineTo(w * 0.92, -hf)
    ctx.lineTo(w * 0.92, -hf - sh * 0.6); ctx.lineTo(w * 0.76, -hf - sh * 0.6); ctx.lineTo(w * 0.72, -hf - sh)
    ctx.lineTo(w * 0.13, -hf - sh); ctx.lineTo(w * 0.05, -hf - sh * 0.66); ctx.closePath()
    ctx.fillStyle = det > 0.15 ? P.white : P.hull; ctx.fill(); rim(ctx, P)
    if (det > 0.3) { ctx.fillStyle = P.glass; for (let r = 0; r < 7; r++) ctx.fillRect(w * 0.09, -hf - w * 0.035 - r * w * 0.05, w * 0.78, w * 0.016) }
    ctx.beginPath(); ctx.rect(w * 0.52, -hf - sh - w * 0.07, w * 0.10, w * 0.09)
    ctx.fillStyle = det > 0.2 ? P.slate : P.hull; ctx.fill(); rim(ctx, P)
  },
  coaster(ctx, w, det, P) {
    const hf = Math.max(2, w * 0.14)
    ctx.beginPath(); ctx.moveTo(0, -hf * 0.5); ctx.lineTo(w * 0.94, -hf); ctx.lineTo(w, -hf * 0.2)
    ctx.lineTo(w, 0); ctx.lineTo(w * 0.03, 0); ctx.closePath(); ctx.fillStyle = P.hull; ctx.fill(); rim(ctx, P)
    if (det > 0.25) { ctx.fillStyle = P.deck; ctx.fillRect(w * 0.14, -hf - w * 0.06, w * 0.40, w * 0.06) }
    if (det > 0.2) {
      ctx.strokeStyle = P.slate; ctx.lineWidth = Math.max(1.2, w * 0.013)
      ctx.beginPath(); ctx.moveTo(w * 0.56, -hf); ctx.lineTo(w * 0.56, -hf - w * 0.20); ctx.stroke()
    }
    ctx.beginPath(); ctx.rect(w * 0.72, -hf - w * 0.24, w * 0.20, w * 0.24)
    ctx.fillStyle = det > 0.2 ? P.deck : P.hull; ctx.fill(); rim(ctx, P)
    ctx.fillStyle = det > 0.2 ? P.slate : P.hull; ctx.fillRect(w * 0.78, -hf - w * 0.31, w * 0.05, w * 0.07)
  },
  yacht(ctx, w, det, P) {
    const hf = Math.max(2, w * 0.11)
    ctx.beginPath(); ctx.moveTo(0, -hf * 0.05); ctx.lineTo(w, -hf * 0.95); ctx.lineTo(w * 0.96, -hf * 0.05)
    ctx.lineTo(w * 0.9, 0); ctx.lineTo(w * 0.05, 0); ctx.closePath(); ctx.fillStyle = det > 0.15 ? P.white : P.hull; ctx.fill(); rim(ctx, P)
    ctx.beginPath(); ctx.moveTo(w * 0.30, -hf); ctx.lineTo(w * 0.72, -hf); ctx.lineTo(w * 0.66, -hf - w * 0.11)
    ctx.lineTo(w * 0.40, -hf - w * 0.14); ctx.lineTo(w * 0.32, -hf - w * 0.09); ctx.closePath()
    ctx.fillStyle = det > 0.2 ? P.glass : P.hull; ctx.fill(); rim(ctx, P)
    if (det > 0.3) {
      ctx.strokeStyle = P.slate; ctx.lineWidth = Math.max(1, w * 0.011)
      ctx.beginPath(); ctx.arc(w * 0.44, -hf - w * 0.14, w * 0.045, Math.PI, 2 * Math.PI); ctx.stroke()
    }
  },
  fishing(ctx, w, det, P) {
    const hf = Math.max(2, w * 0.18)
    ctx.beginPath(); ctx.moveTo(0, -hf * 0.25); ctx.lineTo(w, -hf); ctx.lineTo(w, 0); ctx.lineTo(w * 0.06, 0)
    ctx.closePath(); ctx.fillStyle = P.hull; ctx.fill(); rim(ctx, P)
    ctx.beginPath(); ctx.rect(w * 0.5, -hf - w * 0.24, w * 0.24, w * 0.24)
    ctx.fillStyle = det > 0.2 ? P.deck : P.hull; ctx.fill(); rim(ctx, P)
    if (det > 0.2) {
      ctx.strokeStyle = P.slate; ctx.lineWidth = Math.max(1.4, w * 0.02)
      ctx.beginPath(); ctx.moveTo(w * 0.08, -hf); ctx.lineTo(w * 0.20, -hf - w * 0.28); ctx.lineTo(w * 0.34, -hf); ctx.stroke()
    }
  }
}

function mix(a, b, t) {
  const pa = hex(a), pb = hex(b)
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
function hex(s) {
  if (s[0] === '#') { const m = s.slice(1); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16)) }
  const m = s.match(/\d+/g)                       // 'rgb(r,g,b)' from a prior mix()
  return [+m[0], +m[1], +m[2]]
}
