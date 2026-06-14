import { toRad, bearingTo, haversineKm, normalizeSigned } from './geometry.js'
import { VIEWS, FAR_KM } from './config.js'

const KM_PER_DEG = 111.195
const SPEEDUP = 15 // accelerate drift so motion is visible, but slow enough to hover

// Move a ship along its course. dtSec real seconds, speedup multiplies distance.
export function advanceShip(s, dtSec, speedup = SPEEDUP) {
  const km = s.kn * 1.852 * (dtSec / 3600) * speedup
  const c = toRad(s.course)
  s.lat += (km / KM_PER_DEG) * Math.cos(c)
  s.lon += (km / (KM_PER_DEG * Math.cos(toRad(s.lat)))) * Math.sin(c)
}

export function needsRecycle(s, deck = VIEWS.max, maxKm = FAR_KM) {
  const d = haversineKm(deck.lat, deck.lon, s.lat, s.lon)
  const off = Math.abs(normalizeSigned(bearingTo(deck.lat, deck.lon, s.lat, s.lon) - deck.viewBearing))
  return d > maxKm || d < 1 || off > deck.fov / 2
}

// Respawn a ship somewhere fresh inside the arc, biased to the far side.
export function recycle(s, deck = VIEWS.max) {
  const sign = Math.random() < 0.5 ? -1 : 1
  const off = sign * (deck.fov / 2) * (0.55 + Math.random() * 0.4)
  const brg = (deck.viewBearing + off + 360) % 360
  // Strongly near-biased: from a ~32 m deck the sea horizon is only ~20 km, so keep
  // most ships well inside it (full-hulled and large for a real sense of depth via
  // size), with a few drifting out past the horizon for the hull-down effect.
  const dist = 2 + Math.pow(Math.random(), 2.4) * 22 // ~2..24 km, most near
  const b = toRad(brg), dDeg = dist / KM_PER_DEG
  s.lat = deck.lat + dDeg * Math.cos(b)
  s.lon = deck.lon + dDeg * Math.sin(b) / Math.cos(toRad(deck.lat))
  // Aim the course generally across the view so it drifts through the arc.
  s.course = (deck.viewBearing + (sign < 0 ? 90 : -90) + (Math.random() * 40 - 20) + 360) % 360
}

export function stepFleet(fleet, dtSec, deck = VIEWS.max) {
  for (const s of fleet) {
    advanceShip(s, dtSec)
    if (needsRecycle(s, deck)) recycle(s, deck)
  }
}

// ~9 plausible vessels. Placed by bearing offset + distance, then converted to lat/lon.
// dist spread near→edge so the opening view already shows depth: a couple right
// off the coast (big), a band mid-water, one out at the hull-down edge.
const SEED = [
  { name: 'Maersk Batam', flag: '🇸🇬', type: 'container', dest: 'Willemstad', len: 300, kn: 14, off: -28, dist: 4 },
  { name: 'Bonaire Star', flag: '🇳🇱', type: 'coaster', dest: 'Kralendijk', len: 95, kn: 11, off: -10, dist: 3 },
  { name: 'Caribbean Dawn', flag: '🇧🇸', type: 'cruise', dest: 'Willemstad', len: 290, kn: 17, off: 6, dist: 9 },
  { name: 'Aframax Carina', flag: '🇱🇷', type: 'tanker', dest: 'Punta Cardón', len: 245, kn: 12, off: 20, dist: 15 },
  { name: 'Isla Cargo', flag: '🇵🇦', type: 'bulk', dest: 'Oranjestad', len: 180, kn: 10, off: 34, dist: 22 },
  { name: 'Sea Breeze', flag: '🇫🇷', type: 'yacht', dest: 'Spanish Water', len: 38, kn: 8, off: -18, dist: 5 },
  { name: 'Antilla Trader', flag: '🇵🇦', type: 'coaster', dest: 'La Guaira', len: 110, kn: 12, off: 14, dist: 11 },
  { name: 'Gulf Pioneer', flag: '🇲🇭', type: 'tanker', dest: 'Amuay', len: 250, kn: 13, off: -40, dist: 24 },
  { name: 'Blue Horizon', flag: '🇬🇧', type: 'cruise', dest: 'Willemstad', len: 270, kn: 16, off: 40, dist: 7 }
]

export function makeFleet() {
  return SEED.map((v, i) => {
    const brg = (VIEWS.max.viewBearing + v.off + 360) % 360
    const b = toRad(brg), dDeg = v.dist / KM_PER_DEG
    const lat = VIEWS.max.lat + dDeg * Math.cos(b)
    const lon = VIEWS.max.lon + dDeg * Math.sin(b) / Math.cos(toRad(VIEWS.max.lat))
    const course = (VIEWS.max.viewBearing + (v.off < 0 ? 80 : -80) + 360) % 360
    return { id: i, name: v.name, flag: v.flag, type: v.type, dest: v.dest, len: v.len, kn: v.kn, course, lat, lon }
  })
}
