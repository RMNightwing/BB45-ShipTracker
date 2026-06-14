import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advanceShip, needsRecycle, makeFleet } from './sim.js'
import { bearingTo, haversineKm, normalizeSigned } from './geometry.js'
import { VIEWS } from './config.js'

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`)

test('advanceShip moves east along course 90', () => {
  const s = { lat: 12, lon: -69, course: 90, kn: 10 }
  advanceShip(s, 3600, 1) // 1 hour, speedup 1 -> 10 nm = 18.52 km east
  near(s.lat, 12, 1e-3)
  near(s.lon, -69 + 0.1703, 2e-3)
})

test('advanceShip moves north along course 0', () => {
  const s = { lat: 12, lon: -69, course: 0, kn: 10 }
  advanceShip(s, 3600, 1)
  near(s.lat, 12 + 0.1665, 2e-3)
  near(s.lon, -69, 1e-3)
})

test('needsRecycle true when beyond the field of view', () => {
  // A ship due north of the max view is far off the 223° view centre -> outside fov.
  const v = VIEWS.max
  const s = { lat: v.lat + 0.5, lon: v.lon, course: 0, kn: 10 }
  assert.equal(needsRecycle(s, v, 55), true)
})

test('needsRecycle true when farther than maxKm', () => {
  const v = VIEWS.max
  const s = { lat: v.lat - 0.9, lon: v.lon - 0.1, course: 0, kn: 10 }
  const far = haversineKm(v.lat, v.lon, s.lat, s.lon) > 55
  assert.equal(needsRecycle(s, v, 55), far)
})

test('makeFleet places every ship inside the view arc and envelope', () => {
  const v = VIEWS.max
  const fleet = makeFleet()
  assert.ok(fleet.length >= 8)
  for (const s of fleet) {
    const d = haversineKm(v.lat, v.lon, s.lat, s.lon)
    const off = Math.abs(normalizeSigned(bearingTo(v.lat, v.lon, s.lat, s.lon) - v.viewBearing))
    assert.ok(off <= v.fov / 2, `ship ${s.name} bearing off-arc: ${off}`)
    assert.ok(d >= 4 && d <= 55, `ship ${s.name} distance out of envelope: ${d}`)
  }
})
