# Certificate Anatomy

**Live demo: https://simsi2027.github.io/Certificate-Anatomy/**

An interactive, motion-led learning experience that takes a real (synthetic) TLS certificate and the Certificate Signing Request it came from apart, field by field, then follows a manual issuance from CSR to installed, verified certificate.

It starts with the finished signed certificate and asks one question: *how did all of these fields come together?* Select the certificate to explode it into its real ASN.1 layers, open TBSCertificate and its extensions, and select any field to learn what it is, who set it, whether it came from the CSR and how a client checks it. Then trace back to the CSR, take it apart too, and play the eight-stage manual issuance.

## What you can do

- **Explode and reassemble** the certificate and the CSR. Every layer carries its exact bytes; the assembled block always rebuilds to the same position.
- **Inspect any field**: plain language first, then relationship, security meaning, the parsed value, its source classification and a common failure. Raw hex, Base64 and simplified ASN.1 are available but closed by default.
- **Trace to the CSR**: each certificate field coloured by origin (approved from the request, added by the CA, derived during issuance, CA publication configuration) with a "used during validation" overlay.
- **Compare** the CSR and certificate side by side with explicit relationship paths, backward and forward.
- **See the encoding**: switch the whole artifact between structure, DER hex, Base64 and PEM, coloured by the structure each byte belongs to.
- **Play the manual issuance**: CSR created, submitted, evaluated, issued as a *new* certificate signed by the Issuing CA, returned, installed into Local Computer › Personal, paired with the retained private key, verified.

Keyboard: `Tab` / `Enter` to explore, `Esc` steps back one level, `←` `→` for steps, `P` plays or pauses the issuance, `?` for help. Reduced motion is honoured automatically and can be toggled.

## Synthetic only

Everything is invented (`simsi2027.test`). The certificate, CSR, chain and CRLs are real, verifiable DER structures generated for this project by `scripts/fixtures/generate.mjs`. **No private key, PFX or P12 file exists in this repository**: keys were generated in memory, used to sign, and discarded. Commands such as `certreq` are shown for learning and never executed.

## Run locally (Windows)

```powershell
.\Install-Shortcuts.ps1                      # optional: creates local shortcuts (ignored by Git)
.\tools\windows\Launch-Demo.ps1              # dev server + native Certificate Viewer companion
.\tools\windows\Build-And-Preview.ps1        # production build under /Certificate-Anatomy/
.\tools\windows\Export-Video.ps1             # deterministic film into output\
```

Requires Node.js 20+. No Administrator rights; the execution policy is never changed permanently. Locally, the certificate can also be opened in the native Windows Certificate Viewer through a loopback-only companion (allowlisted `.cer` files, session token, strict origin). The public site works completely without it.

Any platform:

```bash
npm ci
npm run dev                 # http://127.0.0.1:5173
npm test                    # unit + integration (fixtures, PKI rules, motion, companion)
npm run test:e2e            # Playwright
npm run build && npm run smoke:pages
```

## Film

`window.renderAt(t)` on `film.html` renders any frame as a pure function of time. `npm run film:stills` renders shot-boundary stills and a contact sheet; `npm run film:render` writes `output/certificate-anatomy-v0.1.0.mp4` (1920×1080, 60 fps, H.264, silent, ~70 s). Generated media is never committed.

## Documentation

[Architecture](docs/ARCHITECTURE.md) · [CSR anatomy](docs/CSR_ANATOMY.md) · [Certificate anatomy](docs/CERTIFICATE_ANATOMY.md) · [Field relationships](docs/FIELD_RELATIONSHIPS.md) · [Fixtures](docs/FIXTURES.md) · [Motion system](docs/MOTION_SYSTEM.md) · [Testing](docs/TESTING.md) · [Limitations](docs/LIMITATIONS.md) · [Future scope](docs/FUTURE_SCOPE.md) · [v0.1 audit](docs/AUDIT_v0.1.md)

## License

MIT for project code. Bundled fonts (Schibsted Grotesk, Martian Mono) are under the SIL Open Font License via Fontsource.
