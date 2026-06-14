import { drawDeck, drawPalms, drawCompass } from './scene.js'

// Draw the 2D foreground/HUD on the transparent overlay canvas, on top of the
// WebGL world. Order: compass (just above the stone), deck stone+glass, palms.
export function drawOverlay(ctx, W, H, t) {
  drawCompass(ctx, W, H)
  drawDeck(ctx, W, H)
  drawPalms(ctx, W, H, t)
}
