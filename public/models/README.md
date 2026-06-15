# Ship models

`lowpoly_cargoship.glb` — purchased low-poly cargo pack (one GLB, a `Scene` of 5 ships).
Used locally by the app; do not redistribute beyond this project.

Nodes → ship type (see `SHIP_MODELS` in `public/js/config.js`):

| Node | Ship | Mapped type |
|------|------|-------------|
| `boat1` | large container ship | `container` |
| `boat2` | smaller container ship | `coaster` |
| `boat3` | LNG carrier | (spare) |
| `boat4` | bulk/cargo carrier | `bulk` |
| `boat5` | oil tanker | `tanker` |

Each ship is modeled length +X, up +Y, beam +Z. `cruise`/`yacht` have no model here and use
the procedural meshes (`ship-meshes.js`); drop in more GLBs + manifest entries to cover them.
