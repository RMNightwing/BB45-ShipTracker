import { VIEWS, DEFAULT_VIEW, LANDFALL, SIGHTLINE } from './config.js'

// Hygroscopic growth: humidity swells aerosol, raising extinction.
export function humidityFactor(rh) {
  return 1 + SIGHTLINE.humCoef * Math.pow(Math.max(0, Math.min(1, rh / 100)), SIGHTLINE.humPow)
}

// Koschmieder long-range visual range (km) from aerosol optical depth + humidity.
export function sightlineKm(aod, rh) {
  const beta = (Math.max(0.001, aod) / SIGHTLINE.scaleHeightKm) * humidityFactor(rh)
  return Math.min(SIGHTLINE.maxKm, 3.912 / beta)
}

// Verdict for the landfall ridge. opacity 0..1 fades the ghost ridge in.
export function venezuelaVerdict(slKm, distanceKm = LANDFALL.distanceKm) {
  const band = SIGHTLINE.bandKm
  const margin = slKm - distanceKm
  const opacity = Math.max(0, Math.min(1, (margin + band) / (2 * band)))
  let state = 'barely'
  if (margin < -band) state = 'hidden'
  else if (margin > band) state = 'clear'
  return { state, opacity, margin }
}

// --- Live fetch (browser only; not unit-tested) ---

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality'

export async function fetchWeather(lat = VIEWS[DEFAULT_VIEW].lat, lon = VIEWS[DEFAULT_VIEW].lon) {
  const f = new URL(FORECAST)
  f.search = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'America/Curacao',
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,visibility'
  })
  const a = new URL(AIR)
  a.search = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'America/Curacao',
    current: 'aerosol_optical_depth,dust'
  })
  const [fr, ar] = await Promise.all([fetch(f).then(r => r.json()), fetch(a).then(r => r.json())])
  const c = fr.current || {}, q = ar.current || {}
  const aod = q.aerosol_optical_depth ?? 0.1
  const rh = c.relative_humidity_2m ?? 70
  const sl = sightlineKm(aod, rh)
  return {
    tempC: c.temperature_2m, rh, windKn: (c.wind_speed_10m ?? 0) / 1.852,
    windDir: c.wind_direction_10m, cloud: c.cloud_cover, code: c.weather_code,
    visKm: (c.visibility ?? 0) / 1000, dust: q.dust, aod,
    sightlineKm: sl, verdict: venezuelaVerdict(sl)
  }
}
