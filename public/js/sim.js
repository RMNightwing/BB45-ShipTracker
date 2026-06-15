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
  // Spread distances across most of the visible range so the fleet genuinely fans
  // (the perceptual size rule keeps far ships legible, so near-bias is no longer
  // needed). Mild bias keeps a few closer; the far ones go hull-down near the cull.
  const dist = 3 + Math.pow(Math.random(), 1.4) * 33 // ~3..36 km, broadly spread
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
// dist deliberately spread ~4→35 km so the opening view fans across the whole depth:
// a few near (big, low), a mid band, and a couple out near the hull-down edge.
const SEED = [
  { name: 'Maersk Batam', flag: '🇸🇬', type: 'container', dest: 'Willemstad', len: 300, kn: 14, off: -28, dist: 5 },
  { name: 'Bonaire Star', flag: '🇳🇱', type: 'coaster', dest: 'Kralendijk', len: 95, kn: 11, off: -10, dist: 9 },
  { name: 'Caribbean Dawn', flag: '🇧🇸', type: 'cruise', dest: 'Willemstad', len: 290, kn: 17, off: 6, dist: 16 },
  { name: 'Aframax Carina', flag: '🇱🇷', type: 'tanker', dest: 'Punta Cardón', len: 245, kn: 12, off: 20, dist: 23 },
  { name: 'Isla Cargo', flag: '🇵🇦', type: 'bulk', dest: 'Oranjestad', len: 180, kn: 10, off: 34, dist: 31 },
  { name: 'Sea Breeze', flag: '🇫🇷', type: 'yacht', dest: 'Spanish Water', len: 38, kn: 8, off: -18, dist: 4 },
  { name: 'Antilla Trader', flag: '🇵🇦', type: 'coaster', dest: 'La Guaira', len: 110, kn: 12, off: 14, dist: 13 },
  { name: 'Gulf Pioneer', flag: '🇲🇭', type: 'tanker', dest: 'Amuay', len: 250, kn: 13, off: -40, dist: 35 },
  { name: 'Blue Horizon', flag: '🇬🇧', type: 'cruise', dest: 'Willemstad', len: 270, kn: 16, off: 40, dist: 20 }
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
