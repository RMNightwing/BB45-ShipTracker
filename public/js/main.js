import { DECK, USE_SIM, EXAGGERATION, NEAR_KM, FAR_KM } from './config.js'
import { bearingTo, haversineKm, projectX } from './geometry.js'
import { drawSky, drawSea, drawClouds, drawDeck, drawPalms, drawCompass, drawLandfall, horizonY, drawStars, drawMoon } from './scene.js'
import { sunPosition, moonPhase, skyState, projectCelestial } from './sky.js'
import { drawShip, shipAtPoint } from './ships.js'
import { makeFleet, stepFleet } from './sim.js'
import { fetchWeather, venezuelaVerdict } from './weather.js'
import { renderWeather, renderVerdict, initControls, showTooltip, trackSticky, setShipsStatus } from './ui.js'
import { connectRelay } from './relay-client.js'
import { applyShipMessage, buildShips, pruneStale } from './store.js'

// Stylized slow arc for the moon across the night sky (position is decorative;
// only its phase is real).
function moonArc(date, W, hY) {
  const h = date.getHours() + date.getMinutes() / 60
  const u = ((h + 12) % 24) / 24
  const arch = Math.sin(Math.PI * u)
  return { x: W * (0.15 + 0.7 * u), y: hY - arch * hY * 0.7 - hY * 0.05 }
}

const canvas = document.getElementById('view')
const ctx = canvas.getContext('2d')

let W = 0, H = 0, dpr = 1
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = canvas.clientWidth; H = canvas.clientHeight
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
window.addEventListener('resize', resize)
resize()

const fleet = makeFleet()          // kept around so you can toggle back to Sim
let ships = fleet
let wx = null

// Live AIS plumbing (milestone 4): a relay client feeds the store; the frame
// loop derives ships[] from it whenever Live ships is on.
const RELAY_URL = 'ws://localhost:8080'
const SHIP_TTL = 10 * 60 * 1000    // drop ships unheard for 10 min
const store = new Map()
let relay = null, socketOpen = false, upstreamOn = false

function syncLive(on) {
  if (on && !relay) {
    socketOpen = upstreamOn = false
    setShipsStatus('connecting…')
    relay = connectRelay(RELAY_URL, {
      onShip: m => applyShipMessage(store, m, performance.now()),
      onStatus: c => { upstreamOn = c },
      onSocket: o => { socketOpen = o }
    })
  } else if (!on && relay) {
    relay.close(); relay = null; store.clear()
    setShipsStatus('simulated')
  }
}

const controls = initControls(() => {
  renderVerdict(wx, controls.manual ? controls.sightlineKm : null)
  syncLive(controls.live)
})

if (!USE_SIM) { // config asked to start live
  controls.live = true
  const b = document.getElementById('live'); if (b) b.textContent = '📡 Live ships'
  syncLive(true)
}

const STICKY_MS = 2000 // how long a hovered ship's details linger after the cursor leaves
let sticky = { id: null, lastSeen: 0 }
let hitRects = []
let mouse = { x: -1, y: -1 }
canvas.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY } })
canvas.addEventListener('mouseleave', () => { mouse = { x: -1, y: -1 } })

async function loadWeather() {
  try {
    wx = await fetchWeather()
    renderWeather(wx)
    if (!controls.manual) {
      controls.sightlineKm = Math.round(wx.sightlineKm)
      document.getElementById('sl').value = Math.min(200, controls.sightlineKm)
      document.getElementById('sl-val').textContent = `${controls.sightlineKm} km`
    }
    renderVerdict(wx, controls.manual ? controls.sightlineKm : null)
  } catch { renderWeather(null) }
}
loadWeather()
setInterval(() => { if (controls.liveWx) loadWeather() }, 10 * 60 * 1000)

let last = performance.now()
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t
  ctx.clearRect(0, 0, W, H)
  const hY0 = horizonY(W, H)
  const now = new Date()
  const sp = sunPosition(now, DECK.lat, DECK.lon)
  const sproj = projectCelestial(sp.azimuth, sp.elevation, DECK.viewBearing, DECK.fov, W, H, hY0)
  const mp = moonPhase(now)
  const marc = moonArc(now, W, hY0)
  const env = {
    ...skyState(sp.elevation),
    sun: { x: sproj.x == null ? W / 2 : sproj.x, y: sproj.y, visible: sproj.visible, up: sp.elevation > 0 },
    moon: { x: marc.x, y: marc.y, fraction: mp.fraction, waxing: mp.waxing },
    wind: { dir: wx?.windDir ?? 90, kn: wx?.windKn ?? 6 },
    cloudPct: wx?.cloud ?? 40
  }

  drawSky(ctx, W, H, t, env)
  drawStars(ctx, W, H, t, env)
  drawMoon(ctx, W, H, t, env)
  drawClouds(ctx, W, H, t, env)
  drawSea(ctx, W, H, t, env)
  const effSl = controls.manual ? controls.sightlineKm : (wx ? wx.sightlineKm : null)
  if (effSl != null) drawLandfall(ctx, W, H, venezuelaVerdict(effSl).opacity)
  drawCompass(ctx, W, H)

  if (controls.live) {
    pruneStale(store, performance.now(), SHIP_TTL)
    ships = buildShips(store)
    setShipsStatus(
      !socketOpen ? 'relay offline — run: npm run relay'
      : !upstreamOn ? 'relay up · linking to AIS…'
      : `live · ${ships.length} ship${ships.length === 1 ? '' : 's'}`)
  } else {
    if (controls.drift) stepFleet(fleet, dt)
    ships = fleet
  }

  const hY = horizonY(W, H)
  const seaBottom = H - Math.max(26, H * 0.05) - 18
  const sightline = controls.sightlineKm
  hitRects = []
  // Far ships first so nearer ships draw on top.
  const drawable = ships.map(s => {
      const d = haversineKm(DECK.lat, DECK.lon, s.lat, s.lon)
      const b = bearingTo(DECK.lat, DECK.lon, s.lat, s.lon)
      s._bearing = b
      const x = projectX(b, DECK.viewBearing, DECK.fov, W)
      return { s, d, x }
    })
    .filter(o => o.x != null && o.d <= Math.min(FAR_KM, sightline))
    .sort((a, b) => b.d - a.d)
  for (const o of drawable) {
    const rect = drawShip(ctx, o.s, o.x, o.d, W, H, hY, seaBottom, EXAGGERATION, NEAR_KM, FAR_KM)
    if (rect) hitRects.push(rect)
  }

  drawDeck(ctx, W, H)
  drawPalms(ctx, W, H, t)

  // Sticky hover: details follow the held ship after the cursor leaves, until
  // it's been gone STICKY_MS or another ship is hovered.
  const over = mouse.x >= 0 ? shipAtPoint(hitRects, mouse.x, mouse.y) : null
  sticky = trackSticky(sticky, over ? over.ref : null, t, STICKY_MS)
  canvas.style.cursor = over ? 'pointer' : 'default'
  const shown = sticky.showId != null ? hitRects.find(r => r.ref === sticky.showId) : null
  if (shown) showTooltip(shown, over ? mouse.x : shown.x + shown.w, over ? mouse.y : shown.y)
  else showTooltip(null)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
