# Certificate Anatomy - Claude Code Rules

## Project boundary
- Work only inside E:\ClaudeCode\Projects\Certificate-Anatomy.
- Never access unrelated repositories, credentials, browser profiles or personal files.
- Never require Administrator privileges.
- Never use --dangerously-skip-permissions.

## Project purpose
- Build a motion-based learning aid explaining CSR anatomy, certificate anatomy and manual certificate issuance.
- Use synthetic simulation data and real synthetic public cryptographic artifacts.
- Keep explanations accurate, simple and progressive.

## PKI truth rules
- The private key is created on and remains on the requesting machine.
- The CSR contains the public key, requested identity and requested extensions, but never the private key.
- The requesting machine signs the CSR with its private key as proof of possession.
- The Issuing CA evaluates the CSR, creates a new certificate and signs that certificate.
- Never say that the CA signs the CSR as the final certificate.
- The offline Root CA does not participate in leaf issuance.
- The Issuing CA/SubCA signs the leaf certificate.
- AIA and CDP are separate concepts.
- The returned certificate installs on the original requesting machine and associates with its retained private key.

## Visual rules
- Learning clarity comes before visual spectacle.
- Use one active artifact and one primary motion at a time.
- The default experience begins with the signed certificate, then traces backward to the CSR and forward through issuance.
- CSR and signed certificate must remain visually distinct artifacts.
- Clicking an artifact toggles its exploded and assembled views.
- Every field must explain what it is, why it exists and how it relates to request, issuance or validation.
- Avoid neon, particles, excessive glow, network spaghetti and generic AI gradients.

## Engineering rules
- Use deterministic time-driven motion.
- Every rendered frame must be reproducible.
- Preserve cumulative tests.
- Never commit private keys, PFX/P12 files, secrets, generated media, caches or local shortcuts.
- Use Windows PowerShell 5.1-compatible launchers.
- Do not create CMD wrappers.
- Keep the repository organized and the root clean.

## GitHub and release rules
- The GitHub repository must remain public.
- Stable work must be pushed to main.
- Use annotated semantic-version tags.
- Never force push or move a published tag.
- GitHub Pages is the canonical public demo.
- Before reporting a release complete, verify GitHub Pages deploys the newest stable main commit.
