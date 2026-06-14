import { USE_SIM, FAR_KM, VIEWS, DEFAULT_VIEW } from './config.js'
import { bearingTo, haversineKm, enu } from './geometry.js'
import { drawOverlay } from './overlay.js'
import { sunPosition, skyState } from './sky.js'
import { shipAtPoint, padRect } from './ships.js'
import { makeFleet, stepFleet } from './sim.js'
import { fetchWeather } from './weather.js'
import { renderWeather, renderVerdict, initControls, showTooltip, trackSticky, setShipsStatus, initViewToggle } from './ui.js'
import { activeView, onViewChange } from './view.js'
import { createWorld } from './world.js'
import { connectRelay } from './relay-client.js'
import { applyShipMessage, buildShips, pruneStale } from './store.js'

const overlay = document.getElementById('overlay')
const ctx = overlay.getContext('2d')
const world = createWorld(document.getElementById('gl'))
world.setProjection(activeView())
onViewChange(v => world.setProjection(v))

let W = 0, H = 0, dpr = 1
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  W = overlay.clientWidth; H = overlay.clientHeight
  overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  world.resize(W, H)
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
initViewToggle()

if (!USE_SIM) { // config asked to start live
  controls.live = true
  const b = document.getElementById('live'); if (b) b.textContent = '📡 Live ships'
  syncLive(true)
}

const STICKY_MS = 2000 // how long a hovered ship's details linger after the cursor leaves
let sticky = { id: null, lastSeen: 0 }
let hitRects = []
let mouse = { x: -1, y: -1 }
overlay.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY } })
overlay.addEventListener('mouseleave', () => { mouse = { x: -1, y: -1 } })

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
  const v = activeView()
  const now = new Date()
  const sp = sunPosition(now, v.lat, v.lon)
  const env = skyState(sp.elevation)

  const effSl = controls.manual ? controls.sightlineKm : (wx ? wx.sightlineKm : null)
  world.updateEnv({ sunAz: sp.azimuth, sunEl: sp.elevation, sightlineKm: effSl,
    starAlpha: env.starAlpha, windKn: wx?.windKn })

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

  const sightline = controls.sightlineKm
  // Place ships in the 3D world at their true ENU positions; the projection + fog
  // give size, depth, and haze. Hover rects come back projected to screen.
  for (const s of ships) {
    s._distanceKm = haversineKm(v.lat, v.lon, s.lat, s.lon)
    s._bearing = bearingTo(v.lat, v.lon, s.lat, s.lon)
    s._enu = enu(s.lat, s.lon, VIEWS[DEFAULT_VIEW].lat, VIEWS[DEFAULT_VIEW].lon)
  }
  world.updateShips(
    ships.filter(s => s._distanceKm <= Math.min(FAR_KM, sightline)),
    { ambient: env.ambient, deckHeight: v.height }
  )
  world.render(t)
  hitRects = world.shipScreenRects().map(r => ({ ...r, ...padRect(r.x - 14, r.y - 14, 28, 28, 28) }))

  // Sticky hover: details follow the held ship after the cursor leaves, until
  // it's been gone STICKY_MS or another ship is hovered.
  const over = mouse.x >= 0 ? shipAtPoint(hitRects, mouse.x, mouse.y) : null
  sticky = trackSticky(sticky, over ? over.ref : null, t, STICKY_MS)
  overlay.style.cursor = over ? 'pointer' : 'default'
  const shown = sticky.showId != null ? hitRects.find(r => r.ref === sticky.showId) : null
  if (shown) showTooltip(shown, over ? mouse.x : shown.x + shown.w, over ? mouse.y : shown.y)
  else showTooltip(null)
  drawOverlay(ctx, W, H, t)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
