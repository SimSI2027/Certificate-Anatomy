// Source classifications for certificate fields. A field has exactly one source;
// "used during validation" is a separate overlay because almost every field is
// read again by the relying party.

export const CATEGORIES = Object.freeze({
  requested: {
    id: 'requested',
    label: 'Requested in CSR',
    short: 'Requested',
    description: 'Supplied by APP01 inside the signed request.',
  },
  approved: {
    id: 'approved',
    label: 'Approved by CA',
    short: 'Approved',
    description: 'Came from the CSR, then checked and accepted (or changed) by CA policy.',
  },
  added: {
    id: 'added',
    label: 'Added by CA',
    short: 'Added by CA',
    description: 'Chosen by the Issuing CA or its template. The CSR had no say.',
  },
  derived: {
    id: 'derived',
    label: 'Derived during issuance',
    short: 'Derived',
    description: 'Computed by the Issuing CA from keys or bytes while it built the certificate.',
  },
  config: {
    id: 'config',
    label: 'From CA publication configuration',
    short: 'CA config',
    description: 'Locations the CA administrator configured: where to fetch the issuer certificate and the CRL.',
  },
});

export const CERT_CATEGORY_ORDER = ['approved', 'added', 'derived', 'config'];

export const VALIDATION = Object.freeze({
  id: 'validation',
  label: 'Used during validation',
  description: 'Read again later by a client deciding whether to trust the certificate.',
});
