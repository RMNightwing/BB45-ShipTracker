import { drawSky, drawSea, drawClouds } from './scene.js'

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
  drawSky(ctx, W, H, t)
  drawClouds(ctx, W, H, t)
  drawSea(ctx, W, H, t)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
