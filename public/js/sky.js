// Astronomy + sky-color math for the dynamic sky. Pure (no DOM, no clock read):
// every function takes its inputs explicitly so it unit-tests under Node.
// Solar/lunar math adapted from the well-known SunCalc formulas.

import { SKY } from './config.js'

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

const SYNODIC = 29.530588853
const KNOWN_NEW = Date.UTC(2000, 0, 6, 18, 14) / dayMs // days of a known new moon

// Approximate lunar phase. `fraction` is the illuminated fraction (0=new, 1=full);
// `waxing` is true on the way to full (lit limb on one side vs the other). Good to
// ~1 day — enough to draw the right crescent/gibbous.
export function moonPhase(date) {
  const days = date.valueOf() / dayMs - KNOWN_NEW
  const phase = (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC // 0=new .. 0.5=full
  const fraction = (1 - Math.cos(2 * Math.PI * phase)) / 2
  return { phase, fraction, waxing: phase < 0.5 }
}

const lerp = (a, b, u) => a + (b - a) * u
const css = c => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
const CSS_CH = ['skyTop', 'skyBottom', 'seaTop', 'seaBottom', 'horizon']

// Interpolated sky environment for a given sun elevation (deg). Colour channels
// come back as css 'rgb(...)' strings; sunTint stays an [r,g,b] array so callers
// can build rgba glows. ambient/starAlpha are 0..1.
export function skyState(elevationDeg) {
  let hi = SKY[0], lo = SKY[SKY.length - 1]
  if (elevationDeg >= hi.el) lo = hi
  else if (elevationDeg <= lo.el) hi = lo
  else {
    for (let i = 0; i < SKY.length - 1; i++) {
      if (elevationDeg <= SKY[i].el && elevationDeg >= SKY[i + 1].el) { hi = SKY[i]; lo = SKY[i + 1]; break }
    }
  }
  const span = hi.el - lo.el
  const u = span === 0 ? 0 : (hi.el - elevationDeg) / span // 0 at hi, 1 at lo
  const out = {}
  for (const ch of CSS_CH) out[ch] = css(hi[ch].map((v, j) => lerp(v, lo[ch][j], u)))
  out.sunTint = hi.sunTint.map((v, j) => lerp(v, lo.sunTint[j], u))
  out.ambient = lerp(hi.ambient, lo.ambient, u)
  out.starAlpha = lerp(hi.starAlpha, lo.starAlpha, u)
  return out
}
