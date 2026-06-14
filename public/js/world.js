import * as THREE from 'three'

// Owns the WebGL renderer + scene. Task 2 only proves it loads and clears.
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0c1014)

  function resize(w, h) { renderer.setSize(w, h, false) }
  function render() { /* projection added in Task 3 */ }

  return { renderer, scene, resize, render }
}
