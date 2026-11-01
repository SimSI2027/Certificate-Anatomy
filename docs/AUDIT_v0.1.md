# v0.1.0 audit (Generator–Adversary–Normalizer)

One internal cycle, no subagents. Findings were fixed before release unless marked otherwise.

## PKI adversary

| id | rule | severity | location | evidence | fix |
| --- | --- | --- | --- | --- | --- |
| P1 | CA never signs the CSR | — | src, fixtures | sweep `/sign(s\|ed\|ing)? the (csr\|request)/i`: only APP01 signing its own request | none needed; unit test guards issuance copy |
| P2 | Root CA not in leaf issuance | — | issuance.js, layout.js | Root is never a participant; muted card with dim > 0 | tests: participants, muted Root, leaf not verifiable with Root key |
| P3 | Private key locality | — | layout.js | key element stays inside APP01 zone at every stage and mid-transition | unit + e2e tests |
| P4 | Template hint placement | Medium | csr-fields.js | template could be misread as an extension request | modelled as separate Enrollment Name-Value Pair attribute; explanation says it requests no field and may be submission metadata |
| P5 | Omitted ADCS template extension | Low | certificate-fields.js | real ADCS leaf would carry 1.3.6.1.4.1.311.21.7 | absence explained in the Extensions field and docs |
| P6 | AIA vs CDP | — | certificate-fields.js, fixtures | separate extensions, different URLs; AIA "Not revocation information" | fixture check + unit test |
| P7 | Requester cannot force EKU | — | csr-fields.js | explicit "cannot force" wording | unit test |
| P8 | Store placement | — | scenario.js, layout.js | Local Computer › Personal › Certificates; pending request in Certificate Enrollment Requests until -accept | unit + e2e tests |
| P9 | Thumbprint not a field | Low | layout, CSS | thumbprint drawn dashed, outside the structure, "computed, not stored" | — |
| P10 | Not Before backdating | Low | certificate-fields.js | 10-minute skew stated as ADCS default and configurable | — |

## Learning adversary

| id | finding | fix |
| --- | --- | --- |
| L1 | Film captions too dense to read (up to 7.5 words/s) | rewritten; test enforces ≤ 5 words/s |
| L2 | Large open layer left an empty, unexplained area | "N parts opened in the next column" hint |
| L3 | Caption competed with the open explanation | caption text hidden while the inspector is open on desktop |
| L4 | Encoded block not visibly connected to structure | encoding view colours each byte run by structure with byte ranges; plates carry their own hex |

## UI and motion adversary

| id | finding | fix |
| --- | --- | --- |
| U1 | Layers behind the assembled block intercepted clicks | layers are non-interactive until exploded |
| U2 | 3D world plane won hit-testing on phones | camera/world planes `pointer-events: none` |
| U3 | Step rail collided with the wordmark | titles shown for the current step only below 1680 px |
| U4 | Legend overlapped the trace columns | layout reserves legend height in trace mode |
| U5 | Compact plates clipped values; labels over-truncated | inline layout below 52 px; label/value flex fixed |
| U6 | New-certificate frame hid copied fields (paint order) and overlapped the CA key | explicit paint order; CA key moves under the CSR during CA stages |
| U7 | Stacked phone flow overlapped | dedicated single-column phone flow |
| U8 | Film text too small at 1080p | 1440×810 stage scaled 4/3 |
| U9 | Preview served from `/`, hiding subpath bugs | preview uses the Pages base; subpath smoke + e2e |
| U10 | Custom properties ignored by DOM helper (no provenance colour) | `setProperty` for `--*` styles |

## Web Interface Guidelines audit

Applied: curly quotes, `text-wrap: balance` on headings, persistent `h1`, skip link, `aria-live` caption, visible `:focus-visible`, `touch-action: manipulation`, tap highlight, `overscroll-behavior: contain` on inspector and dialog, safe-area insets, `translate="no"` on identifiers and commands, hover states on chips, reduced motion, interruptible motion, pause controls for autoplay, no `transition: all`, no zoom lock.

Deliberate deviations (documented in LIMITATIONS.md): fixed UTC date format instead of `Intl` (determinism), width/height interpolation (crisp text), sentence-case buttons, no URL deep-linking of exploration state in v0.1.0.
