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

function frame(t) {
  ctx.clearRect(0, 0, W, H)
  // Temporary proof-of-life: vertical gradient so we can confirm the loop runs.
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#7fb6e6'); g.addColorStop(1, '#3f7d92')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
