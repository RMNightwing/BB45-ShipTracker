// Astronomy for the real starfield. Pure (no DOM/three) so it unit-tests under node.
// Conventions match sky.js so stars share the sun's azimuth/ENU mapping.
const rad = Math.PI / 180

// Local sidereal time (deg, 0..360) for a date + east-positive longitude (deg).
export function siderealTimeDeg(date, lonDeg) {
  const d = date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545
  return ((280.16 + 360.9856235 * d + lonDeg) % 360 + 360) % 360
}

// Equatorial (RA/Dec deg) → horizon (alt/az deg) for observer latitude + local
// sidereal time. azDeg is a compass bearing (0=N, 90=E), matching sunPosition().
export function raDecToAltAz(raDeg, decDeg, latDeg, lstDeg) {
  const H = (lstDeg - raDeg) * rad, phi = latDeg * rad, dec = decDeg * rad
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  return { altDeg: alt / rad, azDeg: (az / rad + 180 + 360) % 360 }
}

// B–V colour index → approximate star RGB (0..1) via anchor interpolation:
// blue-white (low) → white → yellow → orange-red (high).
const BV_ANCHORS = [
  [-0.4, [0.61, 0.70, 1.00]], [0.0, [0.79, 0.86, 1.00]], [0.4, [1.00, 0.97, 0.95]],
  [0.8, [1.00, 0.91, 0.78]], [1.2, [1.00, 0.82, 0.63]], [1.6, [1.00, 0.74, 0.52]],
  [2.0, [1.00, 0.66, 0.44]]
]
export function bvToColor(bv) {
  const t = Math.max(-0.4, Math.min(2.0, Number.isFinite(bv) ? bv : 0.6))
  for (let i = 1; i < BV_ANCHORS.length; i++) {
    const [t1, c1] = BV_ANCHORS[i]
    if (t <= t1) {
      const [t0, c0] = BV_ANCHORS[i - 1], f = (t - t0) / (t1 - t0)
      return [0, 1, 2].map(k => c0[k] + (c1[k] - c0[k]) * f)
    }
  }
  return BV_ANCHORS[BV_ANCHORS.length - 1][1].slice()
}

// Apparent magnitude → point size (px). Brighter (lower mag) → larger, clamped.
export function magToSize(mag, maxPx = 6, floorPx = 1) {
  const t = (6.5 - mag) / 8                          // -1.5 → ~1, 6.5 → 0
  return Math.max(floorPx, Math.min(maxPx, floorPx + (maxPx - floorPx) * t))
}
