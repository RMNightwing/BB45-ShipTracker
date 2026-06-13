// AIS relay: bridges aisstream.io (live ship positions) to the browser over a
// local WebSocket, normalizing each message into the BB45 relay contract.
// Pure helpers (normalize/subscription/backoff) are unit-tested; the network
// wiring at the bottom only runs when this file is executed directly.

import { pathToFileURL } from 'node:url'

// Bounding box hugging the Blue Bay coast: [[[swLat,swLon],[neLat,neLon]]].
export const BBOX = [[[12.02, -69.12], [12.20, -68.84]]]

const clean = (s) => {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length ? t : undefined
}

// Raw aisstream message → { type:'ship', mmsi, ... } partial update, or null.
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null
  const mmsi = raw.MetaData?.MMSI
  const body = raw.Message?.[raw.MessageType]
  if (mmsi == null || !body) return null

  if (raw.MessageType === 'PositionReport') {
    return {
      type: 'ship', mmsi,
      lat: body.Latitude, lon: body.Longitude, sog: body.Sog, cog: body.Cog
    }
  }
  if (raw.MessageType === 'ShipStaticData') {
    return {
      type: 'ship', mmsi,
      name: clean(body.Name), dest: clean(body.Destination),
      shipType: body.Type || undefined
    }
  }
  return null
}

// The subscribe frame aisstream expects on every (re)connection.
export function subscription(apiKey) {
  return {
    Apikey: apiKey,
    BoundingBoxes: BBOX,
    FilterMessageTypes: ['PositionReport', 'ShipStaticData']
  }
}

// Reconnect backoff: 1s, 2s, 4s … capped at 30s.
export function backoff(attempt) {
  return Math.min(1000 * 2 ** attempt, 30000)
}

// Minimal .env parser: KEY=value per line, # comments and blanks ignored,
// surrounding quotes stripped. Zero-dependency stand-in for dotenv.
export function parseEnv(text) {
  const env = {}
  for (const line of String(text).split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

// --- Network wiring (runs only when this file is executed directly) ---

const UPSTREAM = 'wss://stream.aisstream.io/v0/stream'
const RELAY_PORT = Number(process.env.RELAY_PORT) || 8080

async function main() {
  const { WebSocket, WebSocketServer } = await import('ws')
  const { readFileSync } = await import('node:fs')

  // Read server/.env relative to this module, independent of the launch cwd.
  let env = {}
  try { env = parseEnv(readFileSync(new URL('.env', import.meta.url), 'utf8')) } catch {}
  const apiKey = env.AISSTREAM_API_KEY || process.env.AISSTREAM_API_KEY
  if (!apiKey) {
    console.error('Missing AISSTREAM_API_KEY. Copy server/.env.example to server/.env and add your aisstream.io key.')
    process.exit(1)
  }

  // Browsers connect here; we fan out every ship/status message to them.
  const server = new WebSocketServer({ port: RELAY_PORT })
  server.on('listening', () => console.log(`BB45 relay: ws://localhost:${RELAY_PORT} → aisstream`))
  const broadcast = (msg) => {
    const json = JSON.stringify(msg)
    for (const client of server.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(json)
    }
  }

  // Upstream connection with reconnect + mandatory resubscribe on every open.
  let attempt = 0
  const connect = () => {
    const up = new WebSocket(UPSTREAM)
    up.on('open', () => {
      attempt = 0
      up.send(JSON.stringify(subscription(apiKey)))
      broadcast({ type: 'status', connected: true })
      console.log('aisstream connected, subscription sent')
    })
    up.on('message', (data) => {
      let raw
      try { raw = JSON.parse(data) } catch { return }
      const ship = normalize(raw)
      if (ship) broadcast(ship)
    })
    const reconnect = () => {
      broadcast({ type: 'status', connected: false })
      const delay = backoff(attempt++)
      console.log(`aisstream down, reconnecting in ${delay / 1000}s`)
      setTimeout(connect, delay)
    }
    up.on('close', reconnect)
    up.on('error', (e) => { console.error('aisstream error:', e.message); up.close() })
  }
  connect()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
