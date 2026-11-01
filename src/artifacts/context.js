// Builds the shared data context from raw artifact bytes. Pure: the browser
// passes bytes decoded from bundled PEM files, tests pass bytes read from disk.

import { buildCertificateModel, buildCsrModel, indexTree, bytesEqual } from './model.js';
import { sha1Hex, sha256Hex } from '../crypto/hash.js';
import { CERTIFICATE_FIELDS } from '../anatomy/certificate-fields.js';
import { CSR_FIELDS } from '../anatomy/csr-fields.js';

export function createContext({ leafDer, csrDer, issuingDer, rootDer, manifest }) {
  const cert = buildCertificateModel(leafDer);
  const csr = buildCsrModel(csrDer);
  const issuing = buildCertificateModel(issuingDer);
  const root = buildCertificateModel(rootDer);

  const index = new Map();
  indexTree(cert.tree, index);
  indexTree(csr.tree, index);

  const fingerprints = {
    certSha1: sha1Hex(leafDer),
    certSha256: sha256Hex(leafDer),
    certSpkiSha256: sha256Hex(cert.spkiBytes),
    csrSpkiSha256: sha256Hex(csr.spkiBytes),
    issuingSha1: sha1Hex(issuingDer),
    rootSha1: sha1Hex(rootDer),
  };
  fingerprints.spkiMatch = bytesEqual(cert.spkiBytes, csr.spkiBytes);

  // Synthetic, non-structural nodes the learner can still select.
  const extra = {
    'cert.thumbprint': {
      id: 'cert.thumbprint', label: 'Thumbprint', asn1: 'Computed, not stored', range: [0, leafDer.length],
      value: `SHA-1 ${fingerprints.certSha1}`, children: [], parentId: null,
      data: { sha1: fingerprints.certSha1, sha256: fingerprints.certSha256 },
    },
    'csr.privateKey': {
      id: 'csr.privateKey', label: 'APP01 private key', asn1: 'Not in the CSR', range: null,
      value: 'RSA 2048, stays in the APP01 machine key store', children: [], parentId: null, data: {},
    },
  };

  const node = (id) => index.get(id) || extra[id] || null;
  const definition = (id) => CERTIFICATE_FIELDS[id] || CSR_FIELDS[id] || null;

  return {
    models: { cert, csr, issuing, root },
    trees: { cert: cert.tree, csr: csr.tree },
    index,
    extra,
    node,
    definition,
    bytes: { cert: leafDer, csr: csrDer, issuing: issuingDer, root: rootDer },
    fingerprints,
    manifest,
  };
}
