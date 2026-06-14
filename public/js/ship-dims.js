// Per-type proportions for the low-poly ship meshes. Pure data + math, NO three
// import, so it unit-tests under node. Ratios are fractions of overall length L (m).
export const SHIP_DIMS = {
  container: { beam: 0.14, hullH: 0.090 },
  tanker:    { beam: 0.16, hullH: 0.075 },
  bulk:      { beam: 0.15, hullH: 0.090 },
  cruise:    { beam: 0.13, hullH: 0.060 },
  coaster:   { beam: 0.17, hullH: 0.140 },
  yacht:     { beam: 0.22, hullH: 0.110 },
  default:   { beam: 0.15, hullH: 0.100 }
}

// Resolve a type + length (m) to concrete metre dimensions for the mesh builder.
export function shipDims(type, lenM) {
  const r = SHIP_DIMS[type] || SHIP_DIMS.default
  return { length: lenM, beam: lenM * r.beam, hullH: lenM * r.hullH }
}
