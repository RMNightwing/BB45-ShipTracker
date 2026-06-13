import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compass16, trackSticky } from './ui.js'

test('compass16 maps degrees to 16-point cardinals', () => {
  assert.equal(compass16(0), 'N')
  assert.equal(compass16(90), 'E')
  assert.equal(compass16(202), 'SSW')
})

const TTL = 2000

test('trackSticky: hovering a ship holds and shows it, stamping the time', () => {
  const s = trackSticky({ id: null, lastSeen: 0 }, 7, 1000, TTL)
  assert.deepEqual(s, { id: 7, lastSeen: 1000, showId: 7 })
})

test('trackSticky: after the mouse leaves, the held ship still shows within the TTL', () => {
  const s = trackSticky({ id: 7, lastSeen: 1000 }, null, 1500, TTL)
  assert.equal(s.id, 7)
  assert.equal(s.showId, 7)
})

test('trackSticky: once the TTL elapses with no hover, it clears', () => {
  const s = trackSticky({ id: 7, lastSeen: 1000 }, null, 3001, TTL)
  assert.equal(s.id, null)
  assert.equal(s.showId, null)
})

test('trackSticky: hovering a different ship switches immediately', () => {
  const s = trackSticky({ id: 7, lastSeen: 1000 }, 3, 1200, TTL)
  assert.deepEqual(s, { id: 3, lastSeen: 1200, showId: 3 })
})
