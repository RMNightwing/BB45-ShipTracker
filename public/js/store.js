// Live ship store: merges normalized relay messages into one record per MMSI,
// builds the array the renderer consumes, and prunes vessels gone silent.
// Pure (no DOM, no clock) — the caller passes `now` so this unit-tests cleanly.

const MERGE_FIELDS = ['lat', 'lon', 'sog', 'cog', 'name', 'dest', 'shipType', 'len']
const FALLBACK_LEN = 80 // metres, until a ship's static dimensions arrive

// Apply one { type:'ship', mmsi, ... } partial update into the Map (in place).
export function applyShipMessage(ships, msg, now = 0) {
  if (!msg || msg.type !== 'ship' || msg.mmsi == null) return ships
  const next = { ...(ships.get(msg.mmsi) || { mmsi: msg.mmsi }) }
  for (const k of MERGE_FIELDS) if (msg[k] !== undefined) next[k] = msg[k]
  next.lastSeen = now
  ships.set(msg.mmsi, next)
  return ships
}

// Renderer-shaped array of every ship that has a known position.
export function buildShips(ships) {
  const out = []
  for (const s of ships.values()) {
    if (s.lat == null || s.lon == null) continue
    out.push({
      id: s.mmsi,
      lat: s.lat, lon: s.lon,
      len: s.len || FALLBACK_LEN,
      type: s.shipType,                 // numeric AIS code → coaster silhouette until m5
      name: s.name || `MMSI ${s.mmsi}`,
      dest: s.dest,
      kn: s.sog != null ? s.sog : 0,
      flag: ''                          // country flag arrives in m5
    })
  }
  return out
}

// Drop ships not heard from within maxAgeMs (gone out of range / went dark).
export function pruneStale(ships, now, maxAgeMs) {
  for (const [mmsi, s] of ships) if (now - (s.lastSeen || 0) > maxAgeMs) ships.delete(mmsi)
  return ships
}
