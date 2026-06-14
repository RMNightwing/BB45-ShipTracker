import * as THREE from 'three'
import { SILHOUETTES, shipPalette, lodDetail } from './ships.js'

const TEX_W = 512                       // texture resolution; silhouette occupies the upper ~80%, bottom rows transparent
// Render a ship's silhouette into an offscreen canvas, cropping the lower hull by
// clipFrac (hull-down) so only the superstructure shows. Returns a CanvasTexture.
export function shipTexture(ship, ambient, clipFrac) {
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_W
  const ctx = c.getContext('2d')
  const w = TEX_W * 0.92, baseY = TEX_W * 0.78   // waterline near the lower third
  ctx.save(); ctx.translate((TEX_W - w) / 2, baseY)
  if (clipFrac > 0) {                            // clip away the submerged hull
    const shdH = w * 0.5
    ctx.beginPath(); ctx.rect(-w, -shdH * 2, w * 3, shdH * 2 - clipFrac * shdH); ctx.clip()
  }
  ;(SILHOUETTES[ship.type] || SILHOUETTES.coaster)(ctx, w, lodDetail(120), shipPalette(ambient))
  ctx.restore()
  // Volume shading: a soft sky-lit top → waterline shadow, painted only over the
  // drawn silhouette (source-atop) so a flat profile reads as a solid hull.
  ctx.globalCompositeOperation = 'source-atop'
  const sh = ctx.createLinearGradient(0, baseY - w * 0.55, 0, baseY)
  sh.addColorStop(0, 'rgba(255,255,255,0.16)')
  sh.addColorStop(0.55, 'rgba(255,255,255,0)')
  sh.addColorStop(1, 'rgba(0,0,0,0.30)')
  ctx.fillStyle = sh; ctx.fillRect(0, 0, TEX_W, TEX_W)
  ctx.globalCompositeOperation = 'source-over'
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// A reusable camera-facing sprite for a ship; texture/scale/position set on update.
export function makeShipSprite() {
  const mat = new THREE.SpriteMaterial({ fog: true, transparent: true, depthWrite: false })
  return new THREE.Sprite(mat)
}
