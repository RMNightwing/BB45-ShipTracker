import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shipDims, SHIP_DIMS } from './ship-dims.js'

test('shipDims returns length unchanged and beam/hullH scaled by the type ratio', () => {
  const d = shipDims('container', 300)
  assert.equal(d.length, 300)
  assert.ok(Math.abs(d.beam - 300 * SHIP_DIMS.container.beam) < 1e-9)
  assert.ok(Math.abs(d.hullH - 300 * SHIP_DIMS.container.hullH) < 1e-9)
})

test('shipDims falls back to the default bucket for an unknown type', () => {
  const d = shipDims('submarine', 100)
  assert.ok(Math.abs(d.beam - 100 * SHIP_DIMS.default.beam) < 1e-9)
})

test('every known type has positive beam and hull ratios', () => {
  for (const k of Object.keys(SHIP_DIMS)) {
    assert.ok(SHIP_DIMS[k].beam > 0 && SHIP_DIMS[k].hullH > 0, k)
  }
})
