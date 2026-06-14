import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sunPosition } from './sky.js'

const LAT = 12.135778, LON = -68.989280 // the deck

test('sunPosition: sun is below the horizon at 1am AST', () => {
  const { elevation } = sunPosition(new Date('2026-03-20T05:00:00Z'), LAT, LON) // 01:00 AST
  assert.ok(elevation < 0, `elevation ${elevation}`)
})

test('sunPosition: sun is high near solar noon', () => {
  const { elevation } = sunPosition(new Date('2026-03-20T16:30:00Z'), LAT, LON) // ~12:30 AST
  assert.ok(elevation > 40, `elevation ${elevation}`)
})

test('sunPosition: morning sun is in the eastern half of the compass', () => {
  const { azimuth, elevation } = sunPosition(new Date('2026-03-20T13:00:00Z'), LAT, LON) // 09:00 AST
  assert.ok(elevation > 0, `elevation ${elevation}`)
  assert.ok(azimuth > 60 && azimuth < 170, `azimuth ${azimuth}`)
})

test('sunPosition: late-afternoon sun is in the western half', () => {
  const { azimuth } = sunPosition(new Date('2026-03-20T21:00:00Z'), LAT, LON) // 17:00 AST
  assert.ok(azimuth > 200 && azimuth < 300, `azimuth ${azimuth}`)
})
