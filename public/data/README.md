# Celestial data

Vendored star + constellation data for the night sky, fetched 2026-06-15 from the
[d3-celestial](https://github.com/ofrohn/d3-celestial) project (license: BSD-2-Clause).

| File | What | Source |
|------|------|--------|
| `stars.6.json` | Stars to magnitude 6 (~5044), the naked-eye sky | `https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json` |
| `constellations.lines.json` | Constellation line paths (89 features) | `https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json` |

## Format (what the loader expects)

GeoJSON `FeatureCollection`s. Coordinates are `[RA, Dec]` in **degrees**, with RA wrapped to
`-180..180` (so RA < 0 means `RA + 360`).

- **stars.6.json** — each feature: `geometry.type: "Point"`, `coordinates: [raDeg, decDeg]`;
  `properties: { mag: number, bv: string }` (B–V colour index as a string — `parseFloat` it).
- **constellations.lines.json** — each feature: `geometry.type: "MultiLineString"`,
  `coordinates: [[ [raDeg,decDeg], ... ], ...]`; `properties: { rank: string }` (1 = principal).

To refresh, re-download both files from the source URLs above into this folder.
