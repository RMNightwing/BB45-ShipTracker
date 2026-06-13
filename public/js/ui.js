const COMPASS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
export const compass16 = deg => COMPASS16[Math.round(((deg % 360) / 22.5)) % 16]

const WCODE = { 0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 61: 'Light rain', 63: 'Rain',
  80: 'Showers', 95: 'Thunderstorm' }

export function renderWeather(wx) {
  const el = document.getElementById('wx-body')
  if (!wx) { el.textContent = 'unavailable'; return }
  el.innerHTML = `
    <div class="row"><span>${WCODE[wx.code] || '—'}</span><b>${fmt(wx.tempC)}°C</b></div>
    <div class="row"><span>Wind</span><span>${fmt(wx.windKn)} kn ${compass16(wx.windDir)}</span></div>
    <div class="row"><span>Humidity</span><span>${fmt(wx.rh)}%</span></div>
    <div class="row"><span>Cloud</span><span>${fmt(wx.cloud)}%</span></div>
    <div class="row"><span>Dust AOD</span><span>${(wx.aod ?? 0).toFixed(2)}</span></div>`
}

export function renderVerdict(wx, manualSlKm) {
  const el = document.getElementById('verdict')
  const sl = manualSlKm ?? wx?.sightlineKm
  if (sl == null) { el.textContent = '—'; return }
  const v = wx?.verdict
  const txt = {
    hidden: `Venezuela hidden — Saharan dust. Sightline ≈ ${Math.round(sl)} km.`,
    barely: `On the edge today — can you make out Venezuela? (~70 km)`,
    clear: `Venezuela should be visible — ~70 km, peaks ~900 m.`
  }
  el.textContent = manualSlKm ? `Experimenting: sightline ${Math.round(sl)} km.`
    : (txt[v?.state] || `Sightline ≈ ${Math.round(sl)} km.`)
}

// Wire the slider + toggles. Returns a small state object the loop reads.
export function initControls(onChange) {
  const state = { sightlineKm: 40, drift: true, liveWx: true, manual: false }
  const sl = document.getElementById('sl'), slVal = document.getElementById('sl-val')
  const drift = document.getElementById('drift'), live = document.getElementById('livewx')
  const setSl = v => { slVal.textContent = `${v} km`; }
  setSl(sl.value)
  sl.addEventListener('input', () => { state.sightlineKm = +sl.value; state.manual = true; setSl(sl.value); onChange(state) })
  drift.addEventListener('click', () => { state.drift = !state.drift; drift.textContent = state.drift ? '⏸ Drift' : '▶ Drift'; onChange(state) })
  live.addEventListener('click', () => { state.liveWx = !state.liveWx; live.textContent = state.liveWx ? '◉ Live wx' : '○ Live wx'; onChange(state) })
  return state
}

export function showTooltip(hit, mx, my) {
  const el = document.getElementById('tooltip')
  if (!hit) { el.style.display = 'none'; return }
  const s = hit.ship
  const brg = Math.round(bearingForTip(s))
  el.innerHTML = `<b>${s.flag || ''} ${s.name}</b><br>
    ${s.type} · ${s.dest || '—'}<br>
    ${hit.distanceKm.toFixed(1)} km · ${brg}° ${compass16(brg)}<br>
    ${s.kn} kn · ${s.len} m
    ${hit.hullDown ? '<br><span class="hd">hull-down — superstructure only</span>' : ''}`
  el.style.display = 'block'
  el.style.left = Math.min(mx + 14, window.innerWidth - 250) + 'px'
  el.style.top = (my + 14) + 'px'
}

// Bearing is recomputed by the loop and stashed on the ship as _bearing.
function bearingForTip(s) { return s._bearing ?? 0 }
const fmt = v => v == null ? '—' : Math.round(v)
