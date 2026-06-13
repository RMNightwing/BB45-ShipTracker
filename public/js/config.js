// The deck — source of truth for the whole view. ESTIMATES until calibration (m6).
export const DECK = {
  lat: 12.1349,
  lon: -68.9853,
  height: 28,        // m above sea level
  viewBearing: 202,  // compass dir the deck faces = view centre
  fov: 108           // degrees, edge to edge
}

// Venezuela landfall (the visibility prize).
export const LANDFALL = { bearing: 196, distanceKm: 70, peakM: 900 }

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

// Open-Meteo coast bounding box (SW then NE), hugging the visible water.
export const BBOX = [[12.02, -69.12], [12.20, -68.84]]

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
