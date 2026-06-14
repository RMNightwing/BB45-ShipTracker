import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toRad, toDeg, normalizeSigned, bearingTo, haversineKm, horizonKm,
  shipHorizonKm, projectX, apparentWidthPx, hullDownState, nearness, enu,
  fannedPlacement
} from './geometry.js'
import { VIEWS, LANDFALL } from './config.js'

const near = (a, b, eps = 0.5) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (±${eps})`)

test('toRad', () => near(toRad(180), Math.PI, 1e-9))

test('toDeg', () => near(toDeg(Math.PI), 180, 1e-9))

test('normalizeSigned wraps to [-180,180]', () => {
  near(normalizeSigned(6), 6, 1e-9)
  near(normalizeSigned(200), -160, 1e-9)
  near(normalizeSigned(-190), 170, 1e-9)
  near(normalizeSigned(360), 0, 1e-9)
})

test('bearingTo cardinal directions', () => {
  near(bearingTo(0, 0, 1, 0), 0)     // north
  near(bearingTo(0, 0, 0, 1), 90)    // east
  near(bearingTo(0, 0, -1, 0), 180)  // south
  near(bearingTo(0, 0, 0, -1), 270)  // west
})

test('haversineKm ~111 km per degree on a sphere', () => {
  near(haversineKm(0, 0, 0, 1), 111.19, 0.01)
  near(haversineKm(0, 0, 1, 0), 111.19, 0.01)
})

test('horizonKm = 3.57*sqrt(h)', () => {
  near(horizonKm(28), 18.89, 0.05)
  near(horizonKm(0), 0, 1e-9)
})

test('shipHorizonKm adds deck + superstructure horizons', () => {
  near(shipHorizonKm(28, 30), 18.89 + horizonKm(30), 0.05)
})

test('projectX maps bearing to x, culls outside fov', () => {
  const W = 1000, vb = 202, fov = 108
  near(projectX(202, vb, fov, W), 500)   // centre
  near(projectX(256, vb, fov, W), 1000)  // +fov/2 -> right edge
  near(projectX(148, vb, fov, W), 0)     // -fov/2 -> left edge
  assert.equal(projectX(300, vb, fov, W), null) // beyond half-fov -> culled
})

test('apparentWidthPx shrinks with distance and caps', () => {
  const W = 1000, fov = 108
  near(apparentWidthPx(200, 10, fov, W, 0.25), 10.6, 0.3)
  // 300 m ship at 0.5 km would exceed the cap -> clamped to 0.25*W
  near(apparentWidthPx(300, 0.5, fov, W, 0.25), 250, 1e-6)
})

test('hullDownState: full / hulldown / gone, with clipFrac', () => {
  assert.equal(hullDownState(10, 28, 30).state, 'full')
  assert.equal(hullDownState(10, 28, 30).clipFrac, 0)
  const mid = hullDownState(28.667, 28, 30)
  assert.equal(mid.state, 'hulldown')
  near(mid.clipFrac, 0.5, 0.02)
  assert.equal(hullDownState(40, 28, 30).state, 'gone')
})

test('nearness is 1 near, 0 far, clamped', () => {
  near(nearness(4, 4, 55), 1, 1e-9)
  near(nearness(55, 4, 55), 0, 1e-9)
  near(nearness(29.5, 4, 55), 0.5, 1e-9)
  near(nearness(1, 4, 55), 1, 1e-9) // clamped
  near(nearness(5, 10, 10), 1, 1e-9)   // farKm == nearKm, inside -> 1
  near(nearness(15, 10, 10), 0, 1e-9)  // farKm == nearKm, outside -> 0
})

test('enu maps lat/lon to local east/north metres', () => {
  const o = { lat: 12.135972, lon: -68.989167 }
  assert.deepEqual(enu(o.lat, o.lon, o.lat, o.lon), { e: 0, n: 0 })
  const north = enu(o.lat + 0.01, o.lon, o.lat, o.lon)
  assert.ok(Math.abs(north.n - 1112) < 1 && Math.abs(north.e) < 1e-6)
  const east = enu(o.lat, o.lon + 0.01, o.lat, o.lon)
  assert.ok(Math.abs(east.e - 1087) < 1 && Math.abs(east.n) < 1e-6)
})

test('Venezuela landfall stays in frame in both views', () => {
  for (const name of ['main', 'max']) {
    const v = VIEWS[name]
    const off = Math.abs(normalizeSigned(LANDFALL.bearing - v.viewBearing))
    assert.ok(off <= v.fov / 2, `${name}: landfall ${off.toFixed(1)}° vs half-fov ${v.fov / 2}°`)
  }
})

test('fannedPlacement leaves a far-edge ship unchanged (nearness 0 → scale 1)', () => {
  const eye = { e: 0, n: 0 }, ship = { e: 0, n: 10000 } // 10 km north
  const r = fannedPlacement(eye, ship, 40, 0.7, 2, 40)  // distance == farKm → nearness 0
  assert.equal(r.scale, 1)
  assert.equal(r.e, 0)
  assert.equal(r.n, 10000)
})

test('fannedPlacement preserves bearing (result is colinear with eye→ship)', () => {
  const eye = { e: 0, n: 0 }, ship = { e: 3000, n: 4000 } // 5 km, bearing ~36.9°
  const r = fannedPlacement(eye, ship, 5, 0.7, 2, 40)
  assert.ok(Math.abs(r.e * ship.n - r.n * ship.e) < 1e-6)
  assert.ok(r.scale < 1)
})

test('fannedPlacement preserves apparent size (scale / resultDistance == 1 / trueDistance)', () => {
  const eye = { e: 0, n: 0 }, ship = { e: 0, n: 5000 } // 5 km == 5000 m
  const r = fannedPlacement(eye, ship, 5, 0.7, 2, 40)
  const resultDist = Math.hypot(r.e - eye.e, r.n - eye.n)
  assert.ok(Math.abs(r.scale / resultDist - 1 / 5000) < 1e-9)
})

test('fannedPlacement nudges nearer ships more (smaller scale)', () => {
  const eye = { e: 0, n: 0 }, ship = { e: 0, n: 5000 }
  const near = fannedPlacement(eye, ship, 3, 0.7, 2, 40)
  const far = fannedPlacement(eye, ship, 20, 0.7, 2, 40)
  assert.ok(near.scale < far.scale)
})
