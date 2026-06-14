// Astronomy + sky-color math for the dynamic sky. Pure (no DOM, no clock read):
// every function takes its inputs explicitly so it unit-tests under Node.
// Solar/lunar math adapted from the well-known SunCalc formulas.

const rad = Math.PI / 180
const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545
const e = rad * 23.4397 // obliquity of the ecliptic

const toDays = date => date.valueOf() / dayMs - 0.5 + J1970 - J2000
const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l))
const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l))
const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw

function sunCoords(d) {
  const M = rad * (357.5291 + 0.98560028 * d)                                  // mean anomaly
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + rad * 102.9372 + Math.PI                                   // ecliptic longitude
  return { dec: declination(L, 0), ra: rightAscension(L, 0) }
}

// Real solar position. azimuth in compass degrees (0=N, 90=E, 180=S, 270=W),
// elevation in degrees above the horizon.
export function sunPosition(date, lat, lon) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(date)
  const c = sunCoords(d)
  const H = siderealTime(d, lw) - c.ra
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi))
  const el = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H))
  return { azimuth: (az / rad + 180 + 360) % 360, elevation: el / rad }
}
