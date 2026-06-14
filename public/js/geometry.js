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

// Geometric distance to the sea horizon from height h (m), in km.
// 3.57 is the standard horizon coefficient (~sqrt(2*R_earth) with refraction),
// for h in metres and distance in km.
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
  if (distanceKm <= 0) return capFrac * width
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
  if (farKm <= nearKm) return distanceKm <= nearKm ? 1 : 0
  return Math.max(0, Math.min(1, (farKm - distanceKm) / (farKm - nearKm)))
}

// Local tangent-plane (equirectangular) projection of lat/lon to east/north
// metres about an origin. Accurate to well under a metre over the ~40 km view.
export function enu(lat, lon, lat0, lon0) {
  const e = toRad(lon - lon0) * Math.cos(toRad(lat0)) * R_KM * 1000
  const n = toRad(lat - lat0) * R_KM * 1000
  return { e, n }
}
