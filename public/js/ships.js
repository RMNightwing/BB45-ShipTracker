
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
