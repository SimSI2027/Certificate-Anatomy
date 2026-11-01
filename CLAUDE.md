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

## Learning content rules (v0.1.0)
- Inspector order: plain language, why, relationship, classification, who controls it, security meaning and facts, parsed technical value, source classification, validation use, common failure. Raw views stay closed by default.
- Technical values are always read from the parsed fixture bytes, never hard-coded in copy.
- Certificate source categories: approved (from CSR), added (CA), derived (during issuance), config (CA publication). "Used during validation" is an overlay, not a source.
- The template name travels as a separate CSR attribute, not an extension request; explain it as policy selection.
- The thumbprint is computed, not stored; show it outside the structure.
- Film captions stay at or under 5 words per second.

## Motion and layout rules (v0.1.0)
- All durations, staggers, holds and easings live in src/motion/tokens.js.
- Layouts are pure functions of state (src/motion/layout.js); never accumulate positions from previous frames.
- No CSS transitions on stage elements; the motion loop writes every frame.
- Camera and world planes are pointer-events: none; only artifacts take clicks.
- Interactive and film frames share computeFrame + sample; the film is built from real reducer actions.

## Fixture rules (v0.1.0)
- Keys are generated in memory and discarded; never seed key generation (a committed seed equals a committed key).
- After regenerating fixtures run npm run fixtures:validate and npm test; commit the regenerated public files together.

## Release workflow (v0.1.0)
- Gate: fixtures:validate, npm test, playwright, smoke:pages, PS 5.1 parse, launcher -Smoke runs, native viewer open, film stills + contact sheet review, final MP4 + ffprobe, git diff --check, tracked-file inspection.
- Vite preview must serve under /Certificate-Anatomy/ so subpath bugs surface locally.
- Never kill processes by image name; stop only the PIDs this project started (look them up by port).
