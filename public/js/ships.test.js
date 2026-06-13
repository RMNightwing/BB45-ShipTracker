import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shipAtPoint } from './ships.js'

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
