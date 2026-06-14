import { nearness } from './geometry.js'

// The perceptual ship model: three rules that replace optics with how the eye reads
// the bay. Pure (no three) so they unit-test under node. See
// docs/superpowers/specs/2026-06-14-perceptual-ship-model-design.md.

// Size rule (size constancy). Returns a TARGET ANGULAR SIZE in radians. constancy 0 =
// pure optics (∝ length/distance); 1 = size depends only on length (distance
// irrelevant); ~0.4 = partial constancy (far ships lifted, nearer still larger).
// Clamped to [minA, maxA] (legibility floor / frame cap).
export function apparentAngle(lengthM, trueKm, gain, constancy, minA, maxA) {
  const d = Math.max(0.05, trueKm)
  const raw = gain * lengthM / Math.pow(d, 1 - constancy)
  return Math.min(maxA, Math.max(minA, raw))
}

// Depth/spread rule. Returns the rendered distance (km) along the true bearing ray;
// smaller = lower in the frame. spread 0 = true depression (piled at horizon); higher
// pulls nearer ships down to fan the fleet across the foreground. Never exceeds true.
export function renderedDistanceKm(trueKm, spread, nearKm, farKm) {
  return trueKm * (1 - spread * nearness(trueKm, nearKm, farKm))
}

// Haze rule. Returns clarity 0..1 (1 = crisp) from TRUE distance, gentler than optical
// fog and never below `floor`, so a ship stays a recognizable shape out to the cull.
export function shipClarity(trueKm, farKm, strength, floor) {
  const t = Math.min(1, Math.max(0, trueKm / farKm))
  return Math.max(floor, 1 - strength * (1 - floor) * t)
}
