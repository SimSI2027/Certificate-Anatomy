# Architecture

Vanilla ES modules built with Vite. No UI framework: a small motion loop writes styles directly, so every frame is a pure function of state and time.

```
fixtures/ (committed public DER/PEM)        scripts/fixtures/generate.mjs (keys in memory only)
        │
        ▼
src/asn1/der.js ──► src/artifacts/model.js ──► src/artifacts/context.js   (parsed trees, byte ranges, fingerprints)
                                                       │
src/anatomy/*  (field explanations, categories,        │
                relationships)                         ▼
src/state/machine.js  ── reduce(state, action) ──► src/motion/layout.js  computeFrame(state, viewport) → target frame
                                                       │
src/motion/engine.js  makeTransition / sample(t) ◄─────┘   tokens.js, easing.js, choreography.js
        │
        ▼
src/ui/renderer.js  (DOM plates, SVG brackets and paths) + chrome.js + inspectors/inspector.js
        │
src/app.js (interactive clock)        src/film/timeline.js + film.js (renderAt(t), fixed clock)
```

## Key modules

| Module | Role |
| --- | --- |
| `src/asn1/der.js` | DER decoder keeping exact byte ranges; Base64/PEM helpers. Shared by browser and Node. |
| `src/artifacts/model.js` | Maps DER into the X.509 and PKCS #10 anatomy trees with parsed values. |
| `src/artifacts/context.js` | Builds the data context (models, index, fingerprints via in-browser SHA-1/SHA-256). |
| `src/anatomy/*` | Learning copy for every field, source categories, CSR↔certificate relationships. |
| `src/scenario/*` | The synthetic scenario and the manual issuance flow as data. |
| `src/state/machine.js` | Pure reducer: explode, unfold, select, Escape hierarchy, steps, flow playback. |
| `src/motion/layout.js` | Pure layout for every scene: assembled block, exploded columns (with spine collapse), compare, flow. |
| `src/motion/engine.js` | Interpolates between frames with staggered, eased, deterministic timing. |
| `src/ui/renderer.js` | Applies a frame: transforms, sizes, CSS variables, connector brackets, relationship paths. |
| `src/film/*` | Shot list built from real reducer actions; `renderAt(t)` for frame-exact rendering. |
| `scripts/companion/native-viewer.mjs` | Loopback-only companion that opens allowlisted `.cer` files in Windows Certificate Viewer. |

## Scenes

- **Artifact scene** (`cert`, `csr`): assembled block (tilted camera, visible layer strata) or exploded columns. Column 0 holds the artifact header and its three top-level structures; each open composite adds a column. When width runs out, leading columns collapse to vertical spines.
- **Compare scene**: CSR fields left, certificate fields right, relationship paths in the gutter, stubs for fields with no CSR source.
- **Flow scene**: APP01, Administrator lane and Issuing CA zones; the zone widths shift as the action moves. Phones get a single-column layout of the place where the action happens.

## Public and local modes

The GitHub Pages build bundles all fixtures and needs no server. The local launcher adds the companion and passes its port and token in the URL fragment; the app shows "Open in Windows Certificate Viewer" only when that fragment is valid.

## Deployment

`.github/workflows/pages.yml` runs on every push to `main` (and manually): `npm ci`, fixture validation, unit and integration tests, production build with base `/Certificate-Anatomy/`, the repository-subpath smoke test, then the official Pages upload and deploy actions with minimal permissions.
