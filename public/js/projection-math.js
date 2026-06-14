import { toDeg, toRad, normalizeSigned } from './geometry.js'

// Convert a horizontal FOV (deg) to Three's vertical FOV (deg) for an aspect w/h.
export function vFovFromHFov(hFovDeg, aspect) {
  return toDeg(2 * Math.atan(Math.tan(toRad(hFovDeg) / 2) / aspect))
}

// FogExp2 density (per metre) from the Koschmieder sightline (km): the range at
// which contrast falls to ~2% (ln(0.02) ≈ -3.912). World units are metres.
export function fogDensity(sightlineKm) {
  return 3.912 / (Math.max(0.1, sightlineKm) * 1000)
}

// Compass bearing (deg 0..360, 0=N, 90=E) of a direction in ENU/THREE axes
// (x=east, y=up, z=-north).
export function bearingOfDir(d) {
  return (toDeg(Math.atan2(d.x, -d.z)) + 360) % 360
}

// Tiled panorama: center azimuth offset (deg, relative to viewBearing) of tile i of
// n covering a total fov. Tiles span [-fov/2, +fov/2] left→right.
export function tileAzOffset(i, fov, n) {
  return -fov / 2 + (i + 0.5) * (fov / n)
}

// Tiled panorama: which tile (0..n-1) a relative azimuth (deg from viewBearing) falls
// in, or -1 if outside the fov. Boundaries fall into the upper (rightward) tile.
export function tileIndexForAz(relAzDeg, fov, n) {
  if (relAzDeg < -fov / 2 || relAzDeg > fov / 2) return -1
  const i = Math.floor((relAzDeg + fov / 2) / (fov / n))
  return Math.max(0, Math.min(n - 1, i))
}

// Cylindrical (equidistant) world→screen for the wide view: azimuth linear in x
// across the fov, elevation linear in y (isotropic px/deg). Mirrors the composite
// shader so HUD/tooltips line up with what's drawn. d is a dir from the eye.
export function cylindricalProject(d, view, W, horizonY) {
  const relAz = normalizeSigned(bearingOfDir(d) - view.viewBearing)
  const horiz = Math.hypot(d.x, d.z)
  const elDeg = toDeg(Math.atan2(d.y, horiz))
  const pxPerDeg = W / view.fov
  return {
    x: W * (0.5 + relAz / view.fov),
    y: horizonY - elDeg * pxPerDeg,
    visible: Math.abs(relAz) <= view.fov / 2
  }
}
