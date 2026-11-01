# Field relationships

Source of truth: `src/anatomy/relationships.js` and the `category` of each entry in `src/anatomy/certificate-fields.js`.

## Source categories (certificate fields)

| Category | Meaning | Fields |
| --- | --- | --- |
| Approved by CA | Came from the CSR, then checked and accepted (or changed) by CA policy | Subject, SubjectPublicKeyInfo, SAN, Key Usage, EKU |
| Added by CA | Chosen by the Issuing CA or its template | Version, Serial Number, Signature Algorithm (both copies), Issuer, Validity, Basic Constraints |
| Derived during issuance | Computed by the CA from keys or bytes | Subject Key Identifier, Authority Key Identifier, Certificate Signature Value |
| CA publication configuration | Locations configured by the CA administrator | AIA, CDP |
| Used during validation | Overlay, not a source | Almost every field |

CSR fields are all "Requested in CSR" (supplied by APP01).

## Relationship map

| CSR | Certificate | Classification |
| --- | --- | --- |
| Subject | Subject | Requested, then approved or transformed by CA policy |
| Requested SAN | SAN | Requested, then approved by CA |
| Public key | Public key | Carried from request into certificate (byte-identical) |
| Requested Key Usage | Key Usage | Requested; final value controlled by CA policy |
| Requested EKU | EKU | Requested or template-derived; final value controlled by CA |
| Template attribute | (none) | Names the template; the CA applies that policy |
| CSR signature | (none) | Used to validate the request and prove key possession; not copied |
| (none) | Serial Number | Created by CA |
| (none) | Issuer | Added by CA |
| (none) | Validity | Chosen by CA policy |
| (none) | Basic Constraints | Added by CA policy |
| (none) | SKI | Derived from the carried public key |
| (none) | AKI | Derived from the Issuing CA key |
| (none) | AIA | Added from CA configuration |
| (none) | CDP | Added from CA configuration |
| (none) | Certificate signature | Created by Issuing CA private key |

In this fixture every requested value was approved unchanged; the explanations state that a CA may rewrite or reject requested values and that a requester cannot force an EKU.

## In the app

- **Trace to CSR** colours each certificate plate by category, with filter chips and counts.
- **Compare** draws a path for every pair, a stub (CA / CA config / derived) for certificate-only fields and a terminal mark ("not copied", "selects policy") for CSR-only fields. Selecting either side highlights its path.
- Inspector actions: "Trace back to the CSR" from a certificate field, "See the certificate outcome" from a CSR field.
