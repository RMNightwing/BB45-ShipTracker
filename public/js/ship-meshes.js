import * as THREE from 'three'
import { shipDims } from './ship-dims.js'

// Ships are lit by the scene's sun + ambient, so day/night dimming is automatic; a
// small per-frame emissive (set in world.js) keeps them off pure-black at deep night.
// Local frame: X = beam (starboard +), Y = up (waterline y=0), Z = length (bow −Z).
const C = {
  hull: 0x2a4a57, deck: 0x35525e, white: 0xd8e2e6, dark: 0x223038,
  rust: 0x8a4b39, funnel: 0x3f4a52, slate: 0x56707c,
  boxes: [0x7c4a3a, 0x3f6e72, 0x9c8350, 0x56707c, 0x6b4a52, 0x3f5a6e]
}

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.08, fog: true })
}

// A box (w along X, h along Y, l along Z) centred at (x,y,z).
function box(w, h, l, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), material)
  m.position.set(x, y, z)
  return m
}

// Shared low hull: a main box (y 0..hullH) plus a shorter, narrower forward box for a
// hint of a bow. Length L along Z, beam B along X.
function hull(L, B, hullH, color) {
  const g = new THREE.Group()
  g.add(box(B, hullH, L * 0.92, 0, hullH / 2, L * 0.04, mat(color)))
  g.add(box(B * 0.7, hullH * 0.9, L * 0.12, 0, hullH * 0.5, -L * 0.46, mat(color)))
  return g
}

const BUILDERS = {
  container(L, B, hullH) {
    const g = hull(L, B, hullH, C.hull)
    const rows = 7, cols = 3
    const cellL = (L * 0.66) / rows, cellW = (B * 0.8) / cols, cellH = hullH * 0.9
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tiers = 3 - ((r + c) % 2)
        for (let t = 0; t < tiers; t++) {
          g.add(box(cellW * 0.9, cellH * 0.9, cellL * 0.9,
            (c - (cols - 1) / 2) * cellW, hullH + cellH / 2 + t * cellH,
            (-L * 0.26) + r * cellL, mat(C.boxes[(r + c + t) % C.boxes.length])))
        }
      }
    }
    g.add(box(B * 0.8, hullH * 1.6, L * 0.08, 0, hullH + hullH * 0.8, L * 0.40, mat(C.white)))
    g.add(box(B * 0.25, hullH * 1.1, L * 0.05, 0, hullH + hullH * 2.15, L * 0.42, mat(C.funnel)))
    return g
  },
  tanker(L, B, hullH) {
    const g = hull(L, B, hullH, C.hull)
    g.add(box(B * 0.5, hullH * 0.5, L * 0.5, 0, hullH + hullH * 0.25, -L * 0.02, mat(C.slate)))
    g.add(box(B * 0.85, hullH * 2.2, L * 0.10, 0, hullH + hullH * 1.1, L * 0.40, mat(C.white)))
    g.add(box(B * 0.25, hullH * 1.2, L * 0.05, 0, hullH + hullH * 2.8, L * 0.42, mat(C.funnel)))
    return g
  },
  bulk(L, B, hullH) {
    const g = hull(L, B, hullH, C.hull)
    const hatches = 5
    for (let i = 0; i < hatches; i++) {
      g.add(box(B * 0.7, hullH * 0.3, L * 0.1, 0, hullH + hullH * 0.15,
        (-L * 0.3) + i * (L * 0.6 / (hatches - 1)), mat(C.deck)))
    }
    for (const z of [-L * 0.15, L * 0.10]) {
      g.add(box(B * 0.06, hullH * 2.0, B * 0.06, 0, hullH + hullH, z, mat(C.slate)))
    }
    g.add(box(B * 0.85, hullH * 1.6, L * 0.08, 0, hullH + hullH * 0.8, L * 0.40, mat(C.white)))
    return g
  },
  cruise(L, B, hullH) {
    const g = hull(L, B, hullH, C.dark)
    g.add(box(B * 0.92, hullH * 0.35, L * 0.80, 0, hullH + hullH * 0.4, 0, mat(C.dark)))
    const tiers = 4
    for (let t = 0; t < tiers; t++) {
      const s = 1 - t * 0.12
      g.add(box(B * 0.9 * s, hullH * 1.2, L * 0.78 * s, 0, hullH + hullH * 0.6 + t * hullH * 1.2, 0, mat(C.white)))
    }
    g.add(box(B * 0.3, hullH * 1.4, L * 0.06, 0, hullH + hullH * 0.6 + tiers * hullH * 1.2, L * 0.15, mat(C.funnel)))
    return g
  },
  coaster(L, B, hullH) {
    const g = hull(L, B, hullH, C.rust)
    g.add(box(B * 0.7, hullH * 0.5, L * 0.45, 0, hullH + hullH * 0.25, -L * 0.05, mat(C.deck)))
    g.add(box(B * 0.8, hullH * 1.3, L * 0.14, 0, hullH + hullH * 0.65, L * 0.36, mat(C.white)))
    return g
  },
  yacht(L, B, hullH) {
    const g = hull(L, B, hullH, C.white)
    g.add(box(B * 0.6, hullH * 0.7, L * 0.40, 0, hullH + hullH * 0.35, -L * 0.05, mat(C.white)))
    g.add(box(B * 0.4, hullH * 0.4, L * 0.18, 0, hullH + hullH * 0.9, 0, mat(C.slate)))
    return g
  }
}

// Build a low-poly ship mesh group for {type, len}. Built in true metres in the local
// frame above. Each call makes its own materials, so per-ship clip planes / emissive
// can be set without affecting other ships.
export function makeShipMesh(ship) {
  const d = shipDims(ship.type, ship.len || 80)
  const build = BUILDERS[ship.type] || BUILDERS.coaster
  const g = build(d.length, d.beam, d.hullH)
  const b = new THREE.Box3().setFromObject(g)
  g.userData.heightM = b.max.y - b.min.y
  return g
}

// Every material in a ship group (so world.js can set emissive / clip planes). Call
// BEFORE adding the wake so the wake material is excluded.
export function shipMaterials(group) {
  const out = []
  group.traverse(o => { if (o.material) out.push(o.material) })
  return out
}
