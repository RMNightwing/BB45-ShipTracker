import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shipAtPoint, padRect, nightLift, lodDetail } from './ships.js'

// rects: {ref, x, y, w, h} where x,y is top-left of the ship's hit box.
const rects = [
  { ref: 'far', x: 100, y: 100, w: 20, h: 8 },
  { ref: 'near', x: 90, y: 96, w: 60, h: 24 } // drawn later -> on top where they overlap
]

test('returns the topmost ship under the point', () => {
  assert.equal(shipAtPoint(rects, 110, 104).ref, 'near')
})

test('returns null when nothing is hit', () => {
  assert.equal(shipAtPoint(rects, 5, 5), null)
})

test('hits a non-overlapping ship', () => {
  assert.equal(shipAtPoint([rects[0]], 105, 103).ref, 'far')
})

test('padRect grows a tiny box to the minimum, keeping it centred', () => {
  const r = padRect(100, 100, 4, 2, 28) // 4x2 box centred at (102,101)
  assert.equal(r.w, 28)
  assert.equal(r.h, 28)
  assert.equal(r.x + r.w / 2, 102) // centre x preserved
  assert.equal(r.y + r.h / 2, 101) // centre y preserved
})

test('padRect leaves a box bigger than the minimum untouched', () => {
  const r = padRect(10, 10, 60, 40, 28)
  assert.deepEqual(r, { x: 10, y: 10, w: 60, h: 40 })
})

test('nightLift is 0 in daylight, 1 deep at night, monotonic between', () => {
  assert.equal(nightLift(1), 0)        // full day → faithful dark silhouette
  assert.equal(nightLift(0.6), 0)      // clamps at the daylight end
  assert.equal(nightLift(0.1), 1)      // deep night → fully lifted
  assert.ok(nightLift(0.3) > nightLift(0.45)) // dimmer ambient → more lift
  const v = nightLift(0.36)
  assert.ok(v > 0 && v < 1)            // dusk interpolates
})

test('nightLift treats missing ambient as full daylight', () => {
  assert.equal(nightLift(undefined), 0)
})

test('lodDetail is 0 for a tiny ship and 1 once drawn large, clamped', () => {
  assert.equal(lodDetail(8), 0)        // smudge → flat silhouette, no internal detail
  assert.equal(lodDetail(26), 0)       // at the LOD threshold
  assert.equal(lodDetail(200), 1)      // big close ship → full detail, clamped
  assert.ok(lodDetail(60) > 0 && lodDetail(60) < 1)
})
