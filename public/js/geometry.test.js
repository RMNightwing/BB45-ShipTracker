import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toRad, toDeg, normalizeSigned, bearingTo, haversineKm, horizonKm,
  shipHorizonKm, projectX, apparentWidthPx, hullDownState, nearness
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

test('Venezuela landfall stays in frame in both views', () => {
  for (const name of ['main', 'max']) {
    const v = VIEWS[name]
    const off = Math.abs(normalizeSigned(LANDFALL.bearing - v.viewBearing))
    assert.ok(off <= v.fov / 2, `${name}: landfall ${off.toFixed(1)}° vs half-fov ${v.fov / 2}°`)
  }
})
