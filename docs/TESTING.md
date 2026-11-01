# Testing

| Command | Covers |
| --- | --- |
| `npm test` | Vitest unit and integration suites (Node) |
| `npm run fixtures:validate` | 43 independent fixture checks |
| `npm run test:e2e` | Playwright against the dev server and the production build under `/Certificate-Anatomy/` |
| `npm run smoke:pages` | Built site served under the repository subpath: index, assets, fixtures, film |
| `node scripts/review/capture-screens.mjs` | Visual-review screenshots at 1920×1080, 1440×900, 1366×768, 390×844 and reduced motion (into `output/review/`) |
| `node scripts/film/render.mjs --stills` | Shot-boundary stills, contact sheet, pixel determinism check |

## Unit and integration (Vitest)

- `tests/unit/asn1.test.js`: DER decoding, OIDs, Base64/PEM, in-browser SHA-1/SHA-256 vs Node, ASN.1 outline.
- `tests/unit/anatomy.test.js`: exact X.509 and PKCS #10 structure, complete field definitions, source classifications, CA-only fields, relationships, AIA/CDP separation, EKU wording, private-key locality in the CSR model.
- `tests/unit/motion-state.test.js`: explode, nested unfold, selection switching, Escape hierarchy, exact reassembly, engine determinism, monotonic easing, reduced motion, spine collapse, inspector reservation, flow layout (key stays in APP01 at every stage and mid-transition, CSR to CA, new certificate beside the CSR, Personal store placement, muted Root), captions.
- `tests/unit/scenario-film.test.js`: stage order, Root never a participant, store path, command disclaimer, no "CA signs the CSR" wording, verification list, film duration/format, non-overlapping shots, caption pacing, pure `frameAt`, ending equals opening, output paths, Pages base path, ignored media.
- `tests/integration/fixtures.test.js`: every fixture check, plus tracked-file hygiene (no key/PFX/P12 files, no PRIVATE KEY marker, no media, shortcuts or build output).
- `tests/integration/companion.test.js`: loopback bind, token, origin, Host (DNS rebinding), allowlisted IDs only, no paths, no listings, body size, CER-only allowlist, public-mode absence.

## Playwright

Console-error-free load, opening, explode, Extensions, SAN, Issuer and signature inspection, Escape hierarchy, exact reassembly, header click, background click, trace mode, encodings, CSR explode, public key with fingerprint match, CSR signature, private-key explanation, compare mode, issuance play/pause/next/previous through verification with end actions, key locality on screen, keyboard-only exploration and focus return, reduced motion, responsive layouts without horizontal scroll, downloads, native-viewer local-only behaviour, film determinism (pixel-identical re-render), and the GitHub Pages subpath build.

## Release gate also runs

PowerShell 5.1 parse of every script, `Launch-Demo.ps1 -Smoke`, `Build-And-Preview.ps1 -Smoke`, one native Certificate Viewer open through the companion, film stills review, final MP4 with ffprobe, `git diff --check`, and a tracked-file inspection.
