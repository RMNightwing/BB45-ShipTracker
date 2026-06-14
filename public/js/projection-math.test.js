import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vFovFromHFov, fogDensity, bearingOfDir, cylindricalProject } from './projection-math.js'

test('vFovFromHFov inverts via aspect', () => {
  assert.ok(Math.abs(vFovFromHFov(90, 1) - 90) < 1e-6)
  assert.ok(Math.abs(vFovFromHFov(90, 2) - 53.130) < 1e-3)
})

test('fogDensity from Koschmieder sightline (per metre)', () => {
  assert.ok(Math.abs(fogDensity(40) - 3.912 / 40000) < 1e-12)
  assert.ok(fogDensity(10) > fogDensity(40)) // hazier air = denser fog
})

test('bearingOfDir reads compass bearing from an ENU/THREE dir', () => {
  assert.ok(Math.abs(bearingOfDir({ x: 0, y: 0, z: -1 }) - 0) < 1e-6)   // north (-Z)
  assert.ok(Math.abs(bearingOfDir({ x: 1, y: 0, z: 0 }) - 90) < 1e-6)   // east (+X)
})

test('cylindricalProject maps azimuth linearly across the fov', () => {
  const v = { viewBearing: 219.5, fov: 71 }, W = 1000, horizonY = 300
  const ahead = cylindricalProject({ x: Math.sin(219.5 * Math.PI / 180), y: 0,
    z: -Math.cos(219.5 * Math.PI / 180) }, v, W, horizonY)
  assert.ok(ahead.visible && Math.abs(ahead.x - 500) < 1e-3 && Math.abs(ahead.y - 300) < 1e-3)
  const rightEdge = cylindricalProject({ x: Math.sin(255 * Math.PI / 180), y: 0,
    z: -Math.cos(255 * Math.PI / 180) }, v, W, horizonY)
  assert.ok(rightEdge.visible && Math.abs(rightEdge.x - 1000) < 1e-2)
  const behind = cylindricalProject({ x: Math.sin(40 * Math.PI / 180), y: 0,
    z: -Math.cos(40 * Math.PI / 180) }, v, W, horizonY)
  assert.equal(behind.visible, false)
})
