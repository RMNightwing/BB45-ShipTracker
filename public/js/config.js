// The two measured viewpoints — source of truth for the whole view. Edges were
// taken at night off nearby landmarks and are provisional (fine-tune pending a
// morning check). Keep these easily editable.
//   main: narrow, from further back on the deck. horizon 3.57·√32 ≈ 20.2 km.
//   max:  full sweep, from the deck peak.        horizon 3.57·√30.5 ≈ 19.7 km.
export const VIEWS = {
  main: { label: 'Main',       lat: 12.135972, lon: -68.989167, height: 32,
          viewBearing: 219.5, fov: 71 },   // edges 184° → 255°
  max:  { label: 'Full sweep', lat: 12.135778, lon: -68.989280, height: 30.5,
          viewBearing: 223,   fov: 156 }   // edges 145° → 301°
}
export const DEFAULT_VIEW = 'main'

// Venezuela landfall (the visibility prize). The visible feature is Cerro Santa
// Ana on the Paraguaná Peninsula, not the flat coast. Geometric reach ≈ 122.6 km
// vs 110 km distance → only the peak's top clears the horizon, so the verdict
// sits at hidden/"barely" and effectively never reaches "clearly visible".
export const LANDFALL = { name: 'Venezuela (Cerro Santa Ana)', bearing: 249, distanceKm: 110, peakM: 830 }

// Toggle the simulated fleet. Stays true until the AIS relay lands (m4).
export const USE_SIM = true

// Vertical-spread stylisation. 0 = physically literal (flat row on horizon),
// 1 = dramatic. Bearing and apparent size are NEVER affected by this.
export const EXAGGERATION = 0.5

// Render/recycle envelope (km). FAR_KM tracks the real visible edge: a 30 m
// superstructure from a 30.5 m deck goes hull-down by ≈39 km, so ships at the
// far bound sit on the horizon (nearness→0) and fade out there rather than
// floating below it.
export const NEAR_KM = 4
export const FAR_KM = 40

// Minimum drawn ship width (px), so the farthest vessel is a faint smudge on the
// horizon rather than a sub-pixel that vanishes before the honest hull-down cull.
export const MIN_SHIP_PX = 8

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

// Sky palette keyframes by sun elevation (deg), high → low. Colours are [r,g,b];
// ambient 0..1 dims the sea/clouds; starAlpha 0..1 fades the night sky in.
// skyState() in sky.js interpolates between adjacent rows. Tunable by eye.
export const SKY = [
  { el:  12, skyTop:[127,182,230], skyBottom:[220,234,243], seaTop:[188,214,223], seaBottom:[63,125,146], horizon:[44,91,107], sunTint:[255,248,228], ambient:1.00, starAlpha:0    },
  { el:   2, skyTop:[120,150,200], skyBottom:[255,222,180], seaTop:[150,170,180], seaBottom:[50,95,120],  horizon:[60,80,100], sunTint:[255,226,180], ambient:0.85, starAlpha:0    },
  { el:  -4, skyTop:[40,50,95],    skyBottom:[235,140,90],  seaTop:[60,70,95],    seaBottom:[28,45,70],   horizon:[45,55,80],  sunTint:[255,170,110], ambient:0.45, starAlpha:0.45 },
  { el: -10, skyTop:[18,22,48],    skyBottom:[40,45,80],    seaTop:[20,28,45],    seaBottom:[10,16,30],   horizon:[22,28,48],  sunTint:[120,130,170], ambient:0.18, starAlpha:0.90 },
  { el: -18, skyTop:[8,10,24],     skyBottom:[14,18,38],    seaTop:[8,12,22],     seaBottom:[4,7,16],     horizon:[12,16,30],  sunTint:[80,90,130],   ambient:0.10, starAlpha:1    }
]

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
