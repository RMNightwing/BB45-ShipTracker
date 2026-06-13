import { toRad, bearingTo, haversineKm, normalizeSigned } from './geometry.js'
import { DECK, FAR_KM } from './config.js'

const KM_PER_DEG = 111.195
const SPEEDUP = 90 // accelerate drift so motion is visible

// Move a ship along its course. dtSec real seconds, speedup multiplies distance.
export function advanceShip(s, dtSec, speedup = SPEEDUP) {
  const km = s.kn * 1.852 * (dtSec / 3600) * speedup
  const c = toRad(s.course)
  s.lat += (km / KM_PER_DEG) * Math.cos(c)
  s.lon += (km / (KM_PER_DEG * Math.cos(toRad(s.lat)))) * Math.sin(c)
}

export function needsRecycle(s, deck = DECK, maxKm = FAR_KM) {
  const d = haversineKm(deck.lat, deck.lon, s.lat, s.lon)
  const off = Math.abs(normalizeSigned(bearingTo(deck.lat, deck.lon, s.lat, s.lon) - deck.viewBearing))
  return d > maxKm || d < 1 || off > deck.fov / 2
}

// Respawn a ship somewhere fresh inside the arc, biased to the far side.
export function recycle(s, deck = DECK) {
  const sign = Math.random() < 0.5 ? -1 : 1
  const off = sign * (deck.fov / 2) * (0.55 + Math.random() * 0.4)
  const brg = (deck.viewBearing + off + 360) % 360
  const dist = 28 + Math.random() * 24 // 28..52 km, out near the horizon
  const b = toRad(brg), dDeg = dist / KM_PER_DEG
  s.lat = deck.lat + dDeg * Math.cos(b)
  s.lon = deck.lon + dDeg * Math.sin(b) / Math.cos(toRad(deck.lat))
  // Aim the course generally across the view so it drifts through the arc.
  s.course = (deck.viewBearing + (sign < 0 ? 90 : -90) + (Math.random() * 40 - 20) + 360) % 360
}

export function stepFleet(fleet, dtSec, deck = DECK) {
  for (const s of fleet) {
    advanceShip(s, dtSec)
    if (needsRecycle(s, deck)) recycle(s, deck)
  }
}

// ~9 plausible vessels. Placed by bearing offset + distance, then converted to lat/lon.
const SEED = [
  { name: 'Maersk Batam', flag: '🇸🇬', type: 'container', dest: 'Willemstad', len: 300, kn: 14, off: -28, dist: 22 },
  { name: 'Bonaire Star', flag: '🇳🇱', type: 'coaster', dest: 'Kralendijk', len: 95, kn: 11, off: -10, dist: 9 },
  { name: 'Caribbean Dawn', flag: '🇧🇸', type: 'cruise', dest: 'Willemstad', len: 290, kn: 17, off: 6, dist: 14 },
  { name: 'Aframax Carina', flag: '🇱🇷', type: 'tanker', dest: 'Punta Cardón', len: 245, kn: 12, off: 20, dist: 31 },
  { name: 'Isla Cargo', flag: '🇵🇦', type: 'bulk', dest: 'Oranjestad', len: 180, kn: 10, off: 34, dist: 40 },
  { name: 'Sea Breeze', flag: '🇫🇷', type: 'yacht', dest: 'Spanish Water', len: 38, kn: 8, off: -18, dist: 6 },
  { name: 'Antilla Trader', flag: '🇵🇦', type: 'coaster', dest: 'La Guaira', len: 110, kn: 12, off: 14, dist: 26 },
  { name: 'Gulf Pioneer', flag: '🇲🇭', type: 'tanker', dest: 'Amuay', len: 250, kn: 13, off: -40, dist: 45 },
  { name: 'Blue Horizon', flag: '🇬🇧', type: 'cruise', dest: 'Willemstad', len: 270, kn: 16, off: 40, dist: 18 }
]

export function makeFleet() {
  return SEED.map((v, i) => {
    const brg = (DECK.viewBearing + v.off + 360) % 360
    const b = toRad(brg), dDeg = v.dist / KM_PER_DEG
    const lat = DECK.lat + dDeg * Math.cos(b)
    const lon = DECK.lon + dDeg * Math.sin(b) / Math.cos(toRad(DECK.lat))
    const course = (DECK.viewBearing + (v.off < 0 ? 80 : -80) + 360) % 360
    return { id: i, name: v.name, flag: v.flag, type: v.type, dest: v.dest, len: v.len, kn: v.kn, course, lat, lon }
  })
}
