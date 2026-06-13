// The deck — source of truth for the whole view. MEASURED from the patio (m6).
// Derived horizon at height 30.5 m: waterline = 3.57·√30.5 ≈ 19.7 km.
// Visible-to range: large container (46 m) ≈ 44 km, tanker (30 m) ≈ 39 km,
// small craft ≈ 33 km — then hull-down culls them.
export const DECK = {
  lat: 12.135778,
  lon: -68.989280,
  height: 30.5,      // m above sea level (measured, ~100 ft)
  viewBearing: 223,  // centre of view; measured edges 145° (left) … 301° (right)
  fov: 156           // 301 − 145
}

// Venezuela landfall (the visibility prize). The visible feature is Cerro Santa
// Ana on the Paraguaná Peninsula, not the flat coast. Geometric reach ≈ 122.6 km
// vs 110 km distance → only the peak's top clears the horizon, so the verdict
// sits at hidden/"barely" and effectively never reaches "clearly visible".
export const LANDFALL = { name: 'Venezuela (Cerro Santa Ana)', bearing: 249, distanceKm: 110, peakM: 830 }

// Toggle the simulated fleet. Stays true until the AIS relay lands (m4).
export const USE_SIM = true

// Vertical-spread stylisation. 0 = physically literal (flat row on horizon),
// 1 = dramatic. Bearing and apparent size are NEVER affected by this.
export const EXAGGERATION = 0.3

// Render/recycle envelope (km).
export const NEAR_KM = 4
export const FAR_KM = 55

// Assumed average ship superstructure height (m) for the hull-down horizon.
export const SUPERSTRUCTURE_M = 30

// Apparent-size cap as a fraction of canvas width (keeps a close ship sane).
export const SIZE_CAP_FRAC = 0.25

// aisstream subscription box covering the view wedge out to ~45 km, with a pad.
// [[[swLat,swLon],[neLat,neLon]]], lat first. Imported by the relay.
export const AIS_BBOX = [[[11.70, -69.45], [12.35, -68.72]]]

// Sightline (Koschmieder) calibration knobs — tuned by eye in m6.
export const SIGHTLINE = {
  scaleHeightKm: 1.5,  // aerosol vertical scale height
  humCoef: 0.8,        // how strongly humidity swells aerosol extinction
  humPow: 3,           // humidity growth steepness
  maxKm: 200,          // clamp for very clean air
  bandKm: 15           // half-width of the "barely visible" band around 70 km
}

// Palette.
export const PALETTE = {
  skyTop: '#7fb6e6', skyBottom: '#dceaf3',
  seaTop: '#bcd6df', seaBottom: '#3f7d92',
  horizon: '#2c5b6b',
  ship: '#1e3a44',
  haze: '#cfe0e8',
  travertine: '#efe9dd',
  glass: 'rgba(210,230,235,0.10)',
  palm: 'rgba(20,30,28,0.55)'
}
