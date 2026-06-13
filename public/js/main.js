import { DECK, USE_SIM, EXAGGERATION, NEAR_KM, FAR_KM } from './config.js'
import { bearingTo, haversineKm, projectX } from './geometry.js'
import { drawSky, drawSea, drawClouds, drawDeck, drawPalms, drawCompass, drawLandfall, horizonY } from './scene.js'
import { drawShip, shipAtPoint } from './ships.js'
import { makeFleet, stepFleet } from './sim.js'
import { fetchWeather, venezuelaVerdict } from './weather.js'
import { renderWeather, renderVerdict, initControls, showTooltip } from './ui.js'

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

const fleet = USE_SIM ? makeFleet() : []
let ships = fleet // (milestone 4 will swap this for the live Map-derived array)
let wx = null
const controls = initControls(() => renderVerdict(wx, controls.manual ? controls.sightlineKm : null))

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
  drawSky(ctx, W, H, t)
  drawClouds(ctx, W, H, t)
  drawSea(ctx, W, H, t)
  const effSl = controls.manual ? controls.sightlineKm : (wx ? wx.sightlineKm : null)
  if (effSl != null) drawLandfall(ctx, W, H, venezuelaVerdict(effSl).opacity)
  drawCompass(ctx, W, H)

  if (controls.drift && USE_SIM) stepFleet(fleet, dt)

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

  const hit = mouse.x >= 0 ? shipAtPoint(hitRects, mouse.x, mouse.y) : null
  canvas.style.cursor = hit ? 'pointer' : 'default'
  showTooltip(hit, mouse.x, mouse.y)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
