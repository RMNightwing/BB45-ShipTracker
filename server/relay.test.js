import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, subscription, backoff, parseEnv, BBOX } from './relay.js'

test('normalize: PositionReport → ship update with position/course', () => {
  const raw = {
    MessageType: 'PositionReport',
    MetaData: { MMSI: 244670000 },
    Message: { PositionReport: { Latitude: 12.11, Longitude: -69.0, Sog: 12.3, Cog: 271.5 } }
  }
  assert.deepEqual(normalize(raw), {
    type: 'ship', mmsi: 244670000, lat: 12.11, lon: -69.0, sog: 12.3, cog: 271.5
  })
})

test('normalize: ShipStaticData → ship update with name/dest/type', () => {
  const raw = {
    MessageType: 'ShipStaticData',
    MetaData: { MMSI: 244670000 },
    Message: { ShipStaticData: { Name: 'BLUE BAY', Destination: 'WILLEMSTAD', Type: 70 } }
  }
  assert.deepEqual(normalize(raw), {
    type: 'ship', mmsi: 244670000, name: 'BLUE BAY', dest: 'WILLEMSTAD', shipType: 70
  })
})

test('normalize: ShipStaticData → captures length from AIS dimensions (A+B)', () => {
  const raw = {
    MessageType: 'ShipStaticData',
    MetaData: { MMSI: 1 },
    Message: { ShipStaticData: { Name: 'X', Type: 70, Dimension: { A: 180, B: 70, C: 16, D: 16 } } }
  }
  assert.equal(normalize(raw).len, 250)
})

test('normalize: ShipStaticData without dimensions omits len', () => {
  const raw = {
    MessageType: 'ShipStaticData',
    MetaData: { MMSI: 1 },
    Message: { ShipStaticData: { Name: 'X', Type: 70 } }
  }
  assert.ok(!('len' in normalize(raw)))
})

test('normalize: unknown message type → null', () => {
  assert.equal(normalize({ MessageType: 'AidsToNavigationReport', MetaData: {}, Message: {} }), null)
})

test('normalize: malformed message → null, never throws', () => {
  assert.equal(normalize(null), null)
  assert.equal(normalize({}), null)
  assert.equal(normalize({ MessageType: 'PositionReport' }), null)
})

test('normalize: trims static fields, drops empties to undefined', () => {
  const raw = {
    MessageType: 'ShipStaticData',
    MetaData: { MMSI: 1 },
    Message: { ShipStaticData: { Name: '  BLUE BAY  ', Destination: '', Type: 0 } }
  }
  const out = normalize(raw)
  assert.equal(out.name, 'BLUE BAY')
  assert.equal(out.dest, undefined)
  assert.equal(out.shipType, undefined)
})

test('subscription: wraps key with coast bbox and the two message types', () => {
  const sub = subscription('secret-key')
  assert.equal(sub.Apikey, 'secret-key')
  assert.deepEqual(sub.BoundingBoxes, BBOX)
  assert.deepEqual(sub.FilterMessageTypes, ['PositionReport', 'ShipStaticData'])
})

test('BBOX covers the view wedge out to ~45 km', () => {
  assert.deepEqual(BBOX, [[[11.70, -69.45], [12.35, -68.72]]])
})

test('parseEnv: reads KEY=value pairs, ignores comments and blanks', () => {
  const env = parseEnv('# comment\n\nAISSTREAM_KEY=abc123\nPORT = 9000\n')
  assert.equal(env.AISSTREAM_KEY, 'abc123')
  assert.equal(env.PORT, '9000')
})

test('parseEnv: strips surrounding quotes from values', () => {
  assert.equal(parseEnv('AISSTREAM_KEY="quoted-key"').AISSTREAM_KEY, 'quoted-key')
  assert.equal(parseEnv("AISSTREAM_KEY='quoted-key'").AISSTREAM_KEY, 'quoted-key')
})

test('parseEnv: empty or malformed input → empty object, never throws', () => {
  assert.deepEqual(parseEnv(''), {})
  assert.deepEqual(parseEnv('no-equals-sign'), {})
})

test('backoff: exponential growth capped at 30s, starting near 1s', () => {
  assert.equal(backoff(0), 1000)
  assert.equal(backoff(1), 2000)
  assert.equal(backoff(2), 4000)
  assert.equal(backoff(10), 30000)
  assert.ok(backoff(100) <= 30000)
})
