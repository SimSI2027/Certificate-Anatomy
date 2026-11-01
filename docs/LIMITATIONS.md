# Known limitations (v0.1.0)

- **One scenario.** A single RSA 2048 TLS server request, approved unchanged. Denied, pending and modified requests are described in text only.
- **Simplified certreq output.** The CSR omits Microsoft attributes real certreq adds (OS version, client information, CSP information) and an SKI request. The INF is illustrative; the fixture was produced by the project generator, not certreq.
- **No Certificate Template Information extension** in the leaf, although ADCS adds one for v2+ templates. Explained in the UI.
- **No OCSP.** Revocation is CRL-based only.
- **Root trust is assumed.** The Root CA is already in Trusted Root Certification Authorities on APP01; how it got there (Group Policy, AD publication) is out of scope.
- **Simulation clock.** Validity statements use a fixed clock (2 Nov 2026 09:45 UTC), not the viewer's clock, so the demo never "expires".
- **Fixed date formats.** Dates are formatted in a fixed, locale-independent UTC style (not `Intl`) so that every frame is identical on every machine.
- **Dark theme only.** The studio palette is designed for dark mode; there is no light theme.
- **Phone layout** is functional but compact: deep CSR columns collapse to spines and the issuance flow shows one place at a time.
- **Layout properties animate.** Plates interpolate width and height (not only transform/opacity) so text stays crisp; performance is fine at this element count.
- **Sentence-case buttons**, chosen deliberately over Title Case for a calmer reading voice.
- **Native viewer** requires the local launcher on Windows; the public site explains this instead.
- **English only.**
