---
name: pki-accuracy-review
description: Audit Certificate Anatomy scenario code, learning copy, fixtures and tests against the project's PKI truth rules; use before any release and whenever a field explanation, fixture or issuance stage changes.
---

# PKI accuracy review (Certificate Anatomy)

Project-owned skill. A review step only: **never edit code while reviewing.** Append findings to the current release audit (`docs/AUDIT_v0.1.md` for v0.1.x); fixes happen afterwards.

## Procedure

1. **Load the rules.** Read `CLAUDE.md` ("PKI truth rules" and "Learning content rules"). Sources: `src/anatomy/*.js`, `src/scenario/*.js`, `src/ui/captions.js`, `src/ui/content.js`, `src/film/timeline.js`, `scripts/fixtures/generate.mjs`, `fixtures/`.

2. **Text sweep** across `src/`, `docs/`, `README.md`, `fixtures/requests/*.inf`. Flag wording that says or implies:
   - the CA signs the CSR or turns the CSR into the certificate (`rg -n -i "sign(s|ed|ing)? the (csr|request)|csr becomes|turns? the csr" src docs`; APP01 signing its own request is correct);
   - the CSR, the request transfer, or the certificate contains or moves the private key;
   - the Root CA signs, sees or is contacted for the leaf;
   - AIA is revocation information, or CDP points to a certificate;
   - a requester can force an EKU, name or lifetime;
   - the template attribute is an extension request;
   - the thumbprint is a stored field or a key.

3. **Identity sweep.** Subject `app.simsi2027.test`, key owner APP01 (machine key store), operator/requester `SIMSI2027\CertificateAdmin`. The administrator is never shown as the certificate identity.

4. **Key and store sweep.** APP01's key appears only in the APP01 zone (`flow.key`) and beside the CSR (`csr.privateKey`), never in the lane or CA zone. Leaf installs to Local Computer › Personal › Certificates; the pending request sits in Certificate Enrollment Requests until `certreq -accept`.

5. **Fixture sweep** (parse, never trust comments): `npm run fixtures:validate` must pass all checks; confirm CSR SPKI = leaf SPKI, leaf not verifiable with the Root key, AKI = Issuing CA SKI, AIA/CDP URLs differ, chain order, CRLs signed and current at the simulation clock, no private material tracked.

6. **Test sweep.** Each rule above needs a test that fails if the rule breaks (`tests/unit/anatomy.test.js`, `motion-state.test.js`, `scenario-film.test.js`, `tests/integration/*.test.js`, `tests/e2e/app.spec.js`). List rules without one.

7. **Output.** Table: `| id | rule | severity | location | evidence | fix |`. Critical = teaches false PKI or leaks key material; High = visible rule violation or untested regression risk; Medium = misleading/incomplete wording; Low = polish.
