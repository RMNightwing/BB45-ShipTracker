import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelTransform } from './ship-models-math.js'

test('modelTransform normalizes boat1 (length on X) to unit, base to waterline, bow yaw', () => {
  const t = modelTransform([-3.5, -0.6, -4.8], [3.9, 1.0, -3.5], 90)
  assert.ok(Math.abs(t.scale - 1 / 7.4) < 1e-9)            // 1 / lengthX
  assert.ok(Math.abs(t.offset[0] - -0.2) < 1e-9)           // centre x
  assert.ok(Math.abs(t.offset[1] - 0.6) < 1e-9)            // drop base (−min.y) to y=0
  assert.ok(Math.abs(t.offset[2] - 4.15) < 1e-9)           // centre z
  assert.ok(Math.abs(t.heightUnit - 1.6 / 7.4) < 1e-9)     // height / length
  assert.ok(Math.abs(t.yawRad - Math.PI / 2) < 1e-12)
})

test('modelTransform scale is always 1/lengthX and yaw follows bowYawDeg', () => {
  const t = modelTransform([0, 0, 0], [10, 2, 3], 270)
  assert.ok(Math.abs(t.scale - 0.1) < 1e-12)
  assert.ok(Math.abs(t.yawRad - 3 * Math.PI / 2) < 1e-12)
  assert.ok(Math.abs(t.heightUnit - 0.2) < 1e-12)
})
