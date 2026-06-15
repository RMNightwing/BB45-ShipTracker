import { test } from 'node:test'
import assert from 'node:assert/strict'
import { siderealTimeDeg, raDecToAltAz, bvToColor, magToSize } from './stars.js'

test('siderealTimeDeg is in [0,360), advances with time and with longitude', () => {
  const t0 = new Date(Date.UTC(2026, 5, 15, 0, 0, 0))
  const a = siderealTimeDeg(t0, 0)
  assert.ok(a >= 0 && a < 360)
  const later = siderealTimeDeg(new Date(t0.valueOf() + 3600e3), 0)   // +1h ≈ +15.04°
  assert.ok(Math.abs(((later - a + 360) % 360) - 15.041) < 0.1)
  const east = siderealTimeDeg(t0, 10)
  assert.ok(Math.abs(((east - a + 360) % 360) - 10) < 1e-6)           // +10° lon → +10° LST
})

test('raDecToAltAz: a star on the meridian north of zenith sits due north', () => {
  // H=0 (ra==lst), dec(40) > lat(12): altitude 90-|lat-dec|, azimuth due north (0).
  const r = raDecToAltAz(100, 40, 12, 100)
  assert.ok(Math.abs(r.altDeg - (90 - Math.abs(12 - 40))) < 1e-6)     // 62°
  assert.ok(Math.abs(r.azDeg - 0) < 1e-6 || Math.abs(r.azDeg - 360) < 1e-6)
})

test('raDecToAltAz: a star on the meridian south of zenith sits due south', () => {
  const r = raDecToAltAz(100, -10, 12, 100)                            // dec < lat → south
  assert.ok(Math.abs(r.altDeg - (90 - Math.abs(12 - (-10)))) < 1e-6)   // 68°
  assert.ok(Math.abs(r.azDeg - 180) < 1e-6)
})

test('raDecToAltAz: a star can be below the horizon (negative altitude)', () => {
  const r = raDecToAltAz(280, -80, 12, 100)                            // far south, opposite meridian
  assert.ok(r.altDeg < 0)
})

test('bvToColor: blue for low B–V, red for high, clamped', () => {
  const blue = bvToColor(-0.3), red = bvToColor(1.6)
  assert.ok(blue[2] > blue[0])          // blue channel dominates
  assert.ok(red[0] > red[2])            // red channel dominates
  const clamped = bvToColor(99)
  assert.ok(clamped[0] >= clamped[2])   // clamps to the warm end, no NaN
  assert.ok(clamped.every(Number.isFinite))
})

test('magToSize: brighter (lower mag) is larger, floored and capped', () => {
  assert.ok(magToSize(-1.5, 6, 1) > magToSize(3, 6, 1))
  assert.ok(magToSize(3, 6, 1) > magToSize(6, 6, 1))
  assert.ok(magToSize(20, 6, 1) >= 1)        // floor
  assert.ok(magToSize(-20, 6, 1) <= 6)       // cap
})
