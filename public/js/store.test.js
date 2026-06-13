import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyShipMessage, buildShips, pruneStale } from './store.js'

test('applyShipMessage merges position + static into one ship by MMSI', () => {
  const ships = new Map()
  applyShipMessage(ships, { type: 'ship', mmsi: 5, lat: 12.1, lon: -69, sog: 12.3, cog: 270 }, 1000)
  applyShipMessage(ships, { type: 'ship', mmsi: 5, name: 'BLUE BAY', dest: 'WILLEMSTAD', shipType: 70, len: 250 }, 1100)
  const s = ships.get(5)
  assert.equal(s.lat, 12.1)
  assert.equal(s.name, 'BLUE BAY')
  assert.equal(s.len, 250)
  assert.equal(s.lastSeen, 1100)
})

test('applyShipMessage: a later partial update keeps prior fields', () => {
  const ships = new Map()
  applyShipMessage(ships, { type: 'ship', mmsi: 5, name: 'BLUE BAY', len: 250 }, 1000)
  applyShipMessage(ships, { type: 'ship', mmsi: 5, lat: 12.2, lon: -69.1 }, 2000)
  const s = ships.get(5)
  assert.equal(s.name, 'BLUE BAY') // preserved
  assert.equal(s.lat, 12.2)        // updated
})

test('applyShipMessage ignores non-ship and idless messages', () => {
  const ships = new Map()
  applyShipMessage(ships, { type: 'status', connected: true }, 1000)
  applyShipMessage(ships, { type: 'ship' }, 1000)
  assert.equal(ships.size, 0)
})

test('buildShips: renders positioned ships, fills a length fallback, skips position-less', () => {
  const ships = new Map()
  applyShipMessage(ships, { type: 'ship', mmsi: 5, lat: 12.1, lon: -69, sog: 12 }, 1000)       // no len
  applyShipMessage(ships, { type: 'ship', mmsi: 9, name: 'GHOST', len: 200 }, 1000)             // no position
  const out = buildShips(ships)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 5)
  assert.ok(out[0].len > 0, 'length fallback applied')
  assert.equal(out[0].kn, 12)
})

test('pruneStale drops ships older than maxAge, keeps fresh ones', () => {
  const ships = new Map()
  applyShipMessage(ships, { type: 'ship', mmsi: 1, lat: 12, lon: -69 }, 1000)
  applyShipMessage(ships, { type: 'ship', mmsi: 2, lat: 12, lon: -69 }, 9000)
  pruneStale(ships, 10000, 5000) // now=10000, maxAge=5000 → mmsi 1 (age 9000) gone
  assert.equal(ships.has(1), false)
  assert.equal(ships.has(2), true)
})
