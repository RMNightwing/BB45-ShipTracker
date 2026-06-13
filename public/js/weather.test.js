import { test } from 'node:test'
import assert from 'node:assert/strict'
import { humidityFactor, sightlineKm, venezuelaVerdict } from './weather.js'

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`)

test('humidityFactor grows with RH', () => {
  near(humidityFactor(0), 1, 1e-9)
  assert.ok(humidityFactor(90) > humidityFactor(50))
})

test('sightlineKm: clean air sees far, dusty air does not', () => {
  const clean = sightlineKm(0.08, 45)
  const dusty = sightlineKm(0.40, 80)
  assert.ok(clean > 50, `clean ${clean}`)
  assert.ok(dusty < 20, `dusty ${dusty}`)
  assert.ok(clean > dusty)
})

test('venezuelaVerdict: hidden / barely / clear around 70 km', () => {
  assert.equal(venezuelaVerdict(12, 70).state, 'hidden')
  assert.equal(venezuelaVerdict(70, 70).state, 'barely')
  assert.equal(venezuelaVerdict(110, 70).state, 'clear')
  near(venezuelaVerdict(70, 70).opacity, 0.5, 0.05)
})
