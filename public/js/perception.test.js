import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apparentAngle, renderedDistanceKm, shipClarity } from './perception.js'

// --- apparentAngle ---
test('apparentAngle grows with length and shrinks with distance (partial constancy)', () => {
  const big = apparentAngle(300, 10, 0.0016, 0.4, 0.001, 1)
  const small = apparentAngle(100, 10, 0.0016, 0.4, 0.001, 1)
  assert.ok(big > small)                                   // longer ship → larger
  const near = apparentAngle(200, 3, 0.0016, 0.4, 0.001, 1)
  const far = apparentAngle(200, 20, 0.0016, 0.4, 0.001, 1)
  assert.ok(near > far)                                    // nearer → larger
})

test('apparentAngle at constancy 0 is pure optics (∝ length/distance)', () => {
  const a = apparentAngle(200, 10, 0.0016, 0, 0, 10)
  assert.ok(Math.abs(a - 0.0016 * 200 / 10) < 1e-9)
})

test('apparentAngle at constancy 1 is distance-independent', () => {
  const near = apparentAngle(200, 2, 0.0016, 1, 0, 10)
  const far = apparentAngle(200, 38, 0.0016, 1, 0, 10)
  assert.equal(near, far)
  assert.ok(Math.abs(near - 0.0016 * 200) < 1e-9)
})

test('apparentAngle respects the min floor and max cap', () => {
  assert.equal(apparentAngle(10, 39, 0.0016, 0.4, 0.05, 0.5), 0.05)   // tiny far → floor
  assert.equal(apparentAngle(400, 0.5, 0.0016, 0.4, 0.01, 0.2), 0.2)  // huge near → cap
})

// --- renderedDistanceKm ---
test('renderedDistanceKm equals true distance when spread is 0', () => {
  assert.equal(renderedDistanceKm(12, 0, 2, 40, 0.4, 3, 0.6), 12)
})

test('renderedDistanceKm maps the whole range into the band at full spread', () => {
  assert.ok(Math.abs(renderedDistanceKm(2, 1, 2, 40, 0.4, 3, 0.6) - 0.4) < 1e-9)  // near end → renderNear
  assert.ok(Math.abs(renderedDistanceKm(40, 1, 2, 40, 0.4, 3, 0.6) - 3) < 1e-9)   // far end → renderFar
  const mid = renderedDistanceKm(20, 1, 2, 40, 0.4, 3, 0.6)
  assert.ok(mid > 0.4 && mid < 3)                          // everything lands inside the band
})

test('renderedDistanceKm pulls far ships toward the foreground and stays monotonic', () => {
  const near = renderedDistanceKm(5, 0.95, 2, 40, 0.4, 3, 0.6)
  const far = renderedDistanceKm(35, 0.95, 2, 40, 0.4, 3, 0.6)
  assert.ok(far < 35)                                      // far ship pulled well in
  assert.ok(far > near)                                    // depth order preserved (nearer renders nearer)
})

// --- shipClarity ---
test('shipClarity is 1 at zero distance and decreases with distance', () => {
  assert.equal(shipClarity(0, 40, 0.4, 0.35), 1)
  assert.ok(shipClarity(10, 40, 0.4, 0.35) > shipClarity(30, 40, 0.4, 0.35))
})

test('shipClarity never falls below the floor and is 1 everywhere at strength 0', () => {
  assert.ok(shipClarity(40, 40, 1, 0.35) >= 0.35 - 1e-9)
  assert.equal(shipClarity(40, 40, 1, 0.35), 0.35)
  assert.equal(shipClarity(25, 40, 0, 0.35), 1)
})
