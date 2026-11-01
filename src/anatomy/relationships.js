// How CSR fields relate to certificate fields. Each relationship names a CSR
// node, a certificate node, or both. A missing side is meaningful: it means
// "no CSR source" or "no certificate field".

export const RELATION_KINDS = Object.freeze({
  approved: { label: 'Requested, then approved by CA', category: 'approved' },
  carried: { label: 'Carried from request into certificate', category: 'approved' },
  policy: { label: 'Selects CA policy; no field of its own', category: 'requested' },
  consumed: { label: 'Verified by the CA, then not copied', category: 'requested' },
  added: { label: 'Created or chosen by the CA', category: 'added' },
  derived: { label: 'Derived during issuance', category: 'derived' },
  config: { label: 'Added from CA configuration', category: 'config' },
});

export const RELATIONSHIPS = Object.freeze([
  {
    id: 'subject', csr: 'csr.cri.subject', cert: 'cert.tbs.subject', kind: 'approved',
    classification: 'Requested, then approved or transformed by CA policy',
    note: 'The template lets the requester supply the subject; the CA accepted it unchanged.',
  },
  {
    id: 'san', csr: 'csr.ext.san', cert: 'cert.ext.san', kind: 'approved',
    classification: 'Requested, then approved by CA',
    note: 'Both requested DNS names were approved.',
  },
  {
    id: 'spki', csr: 'csr.cri.spki', cert: 'cert.tbs.spki', kind: 'carried',
    classification: 'Carried from request into certificate',
    note: 'Byte-for-byte identical. The CA checked the algorithm and size, then copied it.',
  },
  {
    id: 'ku', csr: 'csr.ext.ku', cert: 'cert.ext.ku', kind: 'approved',
    classification: 'Requested, but final value controlled by CA policy',
    note: 'The template allows Digital Signature and Key Encipherment, matching the request.',
  },
  {
    id: 'eku', csr: 'csr.ext.eku', cert: 'cert.ext.eku', kind: 'approved',
    classification: 'Requested or template-derived; final value controlled by CA',
    note: 'Server Authentication is the only purpose the template permits.',
  },
  {
    id: 'template', csr: 'csr.attr.template', cert: null, kind: 'policy',
    classification: 'Names the template; the CA applies that policy',
    note: 'No certificate field of its own here. Its effect is the validity, Basic Constraints and purposes the CA chose.',
  },
  {
    id: 'csrsig', csr: 'csr.sigValue', cert: null, kind: 'consumed',
    classification: 'Used to validate the request and prove key possession',
    note: 'No certificate field. The certificate carries the Issuing CA signature instead.',
  },
  {
    id: 'serial', csr: null, cert: 'cert.tbs.serial', kind: 'added',
    classification: 'Created by CA', note: 'No CSR source.',
  },
  {
    id: 'issuer', csr: null, cert: 'cert.tbs.issuer', kind: 'added',
    classification: 'Added by CA', note: 'No CSR source. Names the Issuing CA, not the Root.',
  },
  {
    id: 'validity', csr: null, cert: 'cert.tbs.validity', kind: 'added',
    classification: 'Chosen by CA policy', note: 'No CSR source. One year, from the template.',
  },
  {
    id: 'bc', csr: null, cert: 'cert.ext.bc', kind: 'added',
    classification: 'Added by CA policy', note: 'No CSR source. Marks the certificate as not a CA.',
  },
  {
    id: 'ski', csr: null, cert: 'cert.ext.ski', kind: 'derived',
    classification: 'Derived from the carried public key', note: 'No CSR field; computed from the key that came from the CSR.',
  },
  {
    id: 'aki', csr: null, cert: 'cert.ext.aki', kind: 'derived',
    classification: 'Derived from the Issuing CA key', note: 'No CSR source.',
  },
  {
    id: 'aia', csr: null, cert: 'cert.ext.aia', kind: 'config',
    classification: 'Added from CA configuration', note: 'No CSR source. Points to the issuer certificate.',
  },
  {
    id: 'cdp', csr: null, cert: 'cert.ext.cdp', kind: 'config',
    classification: 'Added from CA configuration', note: 'No CSR source. Points to the CRL.',
  },
  {
    id: 'certsig', csr: null, cert: 'cert.sigValue', kind: 'derived',
    classification: 'Created by Issuing CA private key', note: 'No CSR source. Not the CSR signature.',
  },
]);

export const relationForNode = (nodeId) =>
  RELATIONSHIPS.find((r) => r.csr === nodeId || r.cert === nodeId) ||
  // Child nodes inherit their parent's relationship (e.g. spki.publicKey).
  RELATIONSHIPS.find((r) => (r.csr && nodeId.startsWith(r.csr + '.')) || (r.cert && nodeId.startsWith(r.cert + '.'))) ||
  null;
