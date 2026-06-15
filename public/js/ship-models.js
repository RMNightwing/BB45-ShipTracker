import * as THREE from 'three'
import { GLTFLoader } from '../vendor/three/GLTFLoader.js'
import { SHIP_MODELS } from './config.js'
import { modelTransform } from './ship-models-math.js'

// Loads the purchased GLB once and serves normalized per-type ship models matching
// makeShipMesh's contract (true-metre intrinsic length, base y=0, bow −Z, userData.heightM).
// Geometry + textures are shared across instances (flagged userData.shared); materials are
// cloned per ship so clip-plane/haze/emissive don't bleed. world.js falls back to procedural
// for unmapped types and until this finishes loading.
export function createShipModels() {
  const templates = new Map()   // type -> { group, heightUnit }
  let loaded = false

  new GLTFLoader().load(SHIP_MODELS.file, gltf => {
    for (const [type, nodeName] of Object.entries(SHIP_MODELS.nodes)) {
      try {
        const node = gltf.scene.getObjectByName(nodeName)
        if (!node) { console.warn('[ship-models] node not found:', nodeName); continue }
        const clone = node.clone(true)
        const box = new THREE.Box3().setFromObject(clone)
        const t = modelTransform(box.min.toArray(), box.max.toArray(), SHIP_MODELS.bowYawDeg)
        // recenter (xz) + drop base to waterline, then scale to unit length, then yaw to −Z
        const recenter = new THREE.Group(); recenter.add(clone)
        recenter.position.set(t.offset[0], t.offset[1], t.offset[2])
        const scaled = new THREE.Group(); scaled.add(recenter); scaled.scale.setScalar(t.scale)
        const tpl = new THREE.Group(); tpl.add(scaled); tpl.rotation.y = t.yawRad
        tpl.traverse(o => {                          // flag shared resources (never disposed)
          if (o.geometry) o.geometry.userData.shared = true
          if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material]))
            if (m.map) m.map.userData.shared = true
        })
        templates.set(type, { group: tpl, heightUnit: t.heightUnit })
      } catch (e) {
        console.error('[ship-models] failed to build', type, 'from node', nodeName, e)
      }
    }
    loaded = true
  }, undefined, err => console.error('[ship-models] GLB load failed:', err))

  return {
    modelReady: type => loaded && templates.has(type),
    makeShipModel(s) {
      const tpl = templates.get(s.type); if (!tpl) return null
      const len = s.len || 80
      const inner = tpl.group.clone(true)
      inner.traverse(o => {                         // per-instance materials (shared geometry/maps stay)
        if (o.material) o.material = Array.isArray(o.material)
          ? o.material.map(m => m.clone()) : o.material.clone()
      })
      inner.scale.multiplyScalar(len)               // unit template → true metres
      const outer = new THREE.Group(); outer.add(inner)
      outer.userData.heightM = tpl.heightUnit * len
      outer.userData.isModel = true
      return outer
    }
  }
}
