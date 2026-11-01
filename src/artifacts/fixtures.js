// Browser loader: the synthetic fixtures are bundled with the app, so the public
// GitHub Pages build works with no server and no companion.

import leafPem from '../../fixtures/certificates/app-simsi2027-test.pem?raw';
import issuingPem from '../../fixtures/certificates/simsi2027-issuing-ca-01.pem?raw';
import rootPem from '../../fixtures/certificates/simsi2027-root-ca.pem?raw';
import csrPem from '../../fixtures/requests/app01-request.csr?raw';
import manifest from '../../fixtures/manifest.json';

import leafCerUrl from '../../fixtures/certificates/app-simsi2027-test.cer?url';
import leafPemUrl from '../../fixtures/certificates/app-simsi2027-test.pem?url';
import chainUrl from '../../fixtures/certificates/app-simsi2027-test-chain.pem?url';
import issuingCerUrl from '../../fixtures/certificates/simsi2027-issuing-ca-01.cer?url';
import rootCerUrl from '../../fixtures/certificates/simsi2027-root-ca.cer?url';
import csrUrl from '../../fixtures/requests/app01-request.csr?url';
import csrDerUrl from '../../fixtures/requests/app01-request.der?url';
import infUrl from '../../fixtures/requests/app01-request.inf?url';
import crlUrl from '../../fixtures/crl/simsi2027-issuing-ca-01.crl?url';
import rootCrlUrl from '../../fixtures/crl/simsi2027-root-ca.crl?url';
import manifestUrl from '../../fixtures/manifest.json?url';

import { pemToDer } from '../asn1/der.js';
import { createContext } from './context.js';

export function loadBrowserContext() {
  return createContext({
    leafDer: pemToDer(leafPem, 'CERTIFICATE'),
    issuingDer: pemToDer(issuingPem, 'CERTIFICATE'),
    rootDer: pemToDer(rootPem, 'CERTIFICATE'),
    csrDer: pemToDer(csrPem, 'CERTIFICATE REQUEST'),
    manifest,
  });
}

/** Public artifacts offered for download. Never a key, PFX or P12. */
export const DOWNLOADS = Object.freeze([
  { id: 'leaf-cer', label: 'Issued certificate', file: 'app-simsi2027-test.cer', url: leafCerUrl, note: 'DER' },
  { id: 'leaf-pem', label: 'Issued certificate', file: 'app-simsi2027-test.pem', url: leafPemUrl, note: 'PEM' },
  { id: 'chain', label: 'Certificate chain', file: 'app-simsi2027-test-chain.pem', url: chainUrl, note: 'leaf, Issuing CA, Root' },
  { id: 'csr', label: 'Certificate signing request', file: 'app01-request.csr', url: csrUrl, note: 'PEM' },
  { id: 'csr-der', label: 'Certificate signing request', file: 'app01-request.der', url: csrDerUrl, note: 'DER' },
  { id: 'inf', label: 'Request policy', file: 'app01-request.inf', url: infUrl, note: 'certreq-style INF' },
  { id: 'issuing', label: 'Issuing CA certificate', file: 'simsi2027-issuing-ca-01.cer', url: issuingCerUrl, note: 'DER' },
  { id: 'root', label: 'Root CA certificate', file: 'simsi2027-root-ca.cer', url: rootCerUrl, note: 'DER' },
  { id: 'crl', label: 'Issuing CA CRL', file: 'simsi2027-issuing-ca-01.crl', url: crlUrl, note: 'DER' },
  { id: 'root-crl', label: 'Root CA CRL', file: 'simsi2027-root-ca.crl', url: rootCrlUrl, note: 'DER' },
  { id: 'manifest', label: 'Fixture manifest', file: 'manifest.json', url: manifestUrl, note: 'JSON' },
]);
