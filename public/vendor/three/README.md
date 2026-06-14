# Vendored Three.js

- Version: r0.160.0 (pinned; do not "upgrade in place" without re-testing).
- Source: npm `three@0.160.0` — `build/three.module.js`,
  `examples/jsm/objects/{Sky,Water}.js`, `examples/textures/waternormals.jpg`.
- Imported via the importmap in `public/index.html` (`"three"` → this folder).
- Vendored (not CDN) so BB45 works fully offline / over flaky island internet / via file://.
