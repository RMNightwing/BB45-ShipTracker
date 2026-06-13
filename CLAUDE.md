# BB45 — Blue Bay ship watcher

A first-person "what I'd see looking out from my deck" ship watcher for a house in
Blue Bay, Curaçao. NOT a top-down map — ships are drawn against the real horizon at
their true bearing and apparent size, framed by the deck edge, with a weather-driven
visibility edge. Personal project, one house. Simple and fun.

Full design + rationale: `docs/superpowers/specs/2026-06-13-bb45-design.md`.

## Stack & conventions

- Vanilla JS + HTML Canvas frontend. Native ES modules, no framework, no bundler.
- Node 20+ and the `ws` package for the AIS relay (milestone 3+ only).
- Units metric (km, m, knots, °C). Timezone America/Curaçao (AST).
- No secrets in the frontend. No localStorage. Near-zero dependencies.
- 2-space indent, minimal comments, camelCase. Modules only define functions at
  import time (no DOM at top level) so logic modules unit-test under Node.

## Run

```bash
npm start          # serves public/ at http://localhost:5173
npm test           # runs node --test over the *.test.js files
```

`public/js/config.js` holds `USE_SIM` (simulated fleet, default true until the relay
exists) and the DECK constants (the source of truth for the whole view).

## The geometry (drives everything)

- bearing → horizontal position (exact); distance → apparent size (exact, capped).
- Vertical position is the only stylized axis: a gentle `EXAGGERATION` nudge so
  nearer ships sit lower for legibility. Hull-down onset stays physically exact.
- `horizonKm(h) = 3.57·√h`. From a 28 m deck the sea horizon is ≈18.9 km; a ship's
  superstructure stays visible to ≈38 km, then it is culled.
- The Venezuela ridge (70 km, ~900 m peaks) is gated by an aerosol-derived
  long-range sightline, NOT the API `visibility` field (which caps ~24 km).

## Milestones

1. Scaffold + CLAUDE.md + git. ← done
2. Visual core: scene + geometry + live weather + simulated ships (USE_SIM=true).
3. Relay: server/relay.js → aisstream, key from .env, reconnect + resubscribe.
4. Frontend wiring: connect to relay, feed ships[] from live data, USE_SIM off.
5. Ship identity: AIS type-code → silhouette; MMSI MID → country flag.
6. Calibration: replace DECK estimates with measured values.

## Out of scope

Auth, accounts, databases, deployment. Local-only.
