import * as THREE from 'three'
import { siderealTimeDeg, raDecToAltAz, bvToColor, magToSize } from './stars.js'
import { VIEWS, DEFAULT_VIEW } from './config.js'

const R = 50000                                   // star-sphere radius (matches scene scale)
const LAT = VIEWS[DEFAULT_VIEW].lat, LON = VIEWS[DEFAULT_VIEW].lon

// Build the night sky: a Points cloud (per-star size+colour) + constellation
// LineSegments, both recomputed from the clock so the sky wheels overhead. Loads the
// vendored catalog; on failure falls back to a random faint field (never a grid).
export function createStarField(scene) {
  let stars = null, lines = null, starData = [], lineData = [], lastMs = -1

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vColor;
      void main(){ vColor = aColor; gl_PointSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision mediump float; uniform float uAlpha; varying vec3 vColor;
      void main(){ float a = smoothstep(0.5, 0.15, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vColor, a * uAlpha); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
  })
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x6f86b0, transparent: true, opacity: 0, depthWrite: false, fog: false
  })

  function buildObjects() {
    if (stars) { scene.remove(stars); stars.geometry.dispose() }
    const n = starData.length
    const pos = new Float32Array(n * 3), aSize = new Float32Array(n), aColor = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      aSize[i] = starData[i].size
      const c = starData[i].color; aColor[i * 3] = c[0]; aColor[i * 3 + 1] = c[1]; aColor[i * 3 + 2] = c[2]
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3))
    stars = new THREE.Points(g, starMat); stars.frustumCulled = false; scene.add(stars)

    if (lines) { scene.remove(lines); lines.geometry.dispose() }
    let vcount = 0; for (const pl of lineData) vcount += Math.max(0, pl.length - 1) * 2
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, vcount) * 3), 3))
    lines = new THREE.LineSegments(lg, lineMat); lines.frustumCulled = false; scene.add(lines)
    lastMs = -1                                   // force a recompute on next update
  }

  function recompute(date) {
    if (!stars) return
    const lst = siderealTimeDeg(date, LON)
    const pos = stars.geometry.attributes.position.array, size = stars.geometry.attributes.aSize.array
    for (let i = 0; i < starData.length; i++) {
      const s = starData[i], { altDeg, azDeg } = raDecToAltAz(s.ra, s.dec, LAT, lst)
      size[i] = altDeg < 0 ? 0 : s.size            // hide below-horizon stars
      const al = altDeg * Math.PI / 180, az = azDeg * Math.PI / 180, ca = Math.cos(al)
      pos[i * 3] = R * ca * Math.sin(az); pos[i * 3 + 1] = R * Math.sin(al); pos[i * 3 + 2] = -R * ca * Math.cos(az)
    }
    stars.geometry.attributes.position.needsUpdate = true
    stars.geometry.attributes.aSize.needsUpdate = true

    const lp = lines.geometry.attributes.position.array; let k = 0
    for (const pl of lineData) {
      for (let j = 0; j < pl.length - 1; j++) {
        for (const p of [pl[j], pl[j + 1]]) {
          const { altDeg, azDeg } = raDecToAltAz(p[0], p[1], LAT, lst)
          const al = altDeg * Math.PI / 180, az = azDeg * Math.PI / 180, ca = Math.cos(al)
          lp[k++] = R * ca * Math.sin(az); lp[k++] = R * Math.sin(al); lp[k++] = -R * ca * Math.cos(az)
        }
      }
    }
    lines.geometry.attributes.position.needsUpdate = true
  }

  function buildFromCatalog(starsJson, linesJson) {
    starData = starsJson.features.map(f => {
      const c = f.geometry.coordinates
      return { ra: c[0] < 0 ? c[0] + 360 : c[0], dec: c[1],
        size: magToSize(f.properties.mag, 6), color: bvToColor(parseFloat(f.properties.bv)) }
    })
    lineData = []
    for (const f of linesJson.features) for (const seg of f.geometry.coordinates)
      lineData.push(seg.map(p => [p[0] < 0 ? p[0] + 360 : p[0], p[1]]))
    buildObjects()
  }

  function buildFallback() {
    starData = []
    for (let i = 0; i < 1500; i++) {
      starData.push({ ra: Math.random() * 360, dec: Math.asin(2 * Math.random() - 1) / Math.PI * 180,
        size: 1 + Math.random() * Math.random() * 3.5, color: [1, 1, 0.96] })
    }
    lineData = []
    buildObjects()
  }

  Promise.all([
    fetch('data/stars.6.json').then(r => { if (!r.ok) throw new Error('stars ' + r.status); return r.json() }),
    fetch('data/constellations.lines.json').then(r => { if (!r.ok) throw new Error('lines ' + r.status); return r.json() })
  ]).then(([s, l]) => buildFromCatalog(s, l))
    .catch(e => { console.warn('[stars] catalog load failed; random fallback:', e.message); buildFallback() })

  return {
    update(date) {
      if (!stars) return
      const ms = date.valueOf()
      if (lastMs > 0 && ms - lastMs < 12000) return    // sky moves ~0.25°/min — recompute every ~12s
      lastMs = ms
      recompute(date)
    },
    setNightAlpha(a) { starMat.uniforms.uAlpha.value = a; lineMat.opacity = a * 0.45 },
    setLinesVisible(b) { if (lines) lines.visible = b }
  }
}
