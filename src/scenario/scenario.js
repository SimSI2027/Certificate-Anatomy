// The single synthetic scenario. Every name, address and date here is invented.
// The fixture generator builds the cryptographic artifacts from these values,
// and the application reads the parsed artifacts back - never these constants -
// when it displays a technical value.

export const SCENARIO = Object.freeze({
  administrator: 'SIMSI2027\\CertificateAdmin',
  requestingMachine: 'APP01.simsi2027.test',
  requestingMachineShort: 'APP01',
  service: 'app.simsi2027.test',
  additionalSan: 'www.app.simsi2027.test',
  organization: 'SIMSI2027 Synthetic Lab',
  issuingCa: 'SIMSI2027 Issuing CA 01',
  issuingCaHost: 'ICA01.simsi2027.test',
  rootCa: 'SIMSI2027 Root CA',
  template: 'SIMSI2027ManualWebServer',
  purpose: 'TLS Server Authentication',
  keyAlgorithm: 'RSA 2048',
  requestId: 1047,
  caConfig: 'ICA01.simsi2027.test\\SIMSI2027 Issuing CA 01',
  store: ['Certificates (Local Computer)', 'Personal', 'Certificates'],
  pendingStore: ['Certificates (Local Computer)', 'Certificate Enrollment Requests', 'Certificates'],
  urls: Object.freeze({
    issuingAia: 'http://pki.simsi2027.test/aia/SIMSI2027-Issuing-CA-01.crt',
    issuingCdp: 'http://pki.simsi2027.test/cdp/SIMSI2027-Issuing-CA-01.crl',
    rootAia: 'http://pki.simsi2027.test/aia/SIMSI2027-Root-CA.crt',
    rootCdp: 'http://pki.simsi2027.test/cdp/SIMSI2027-Root-CA.crl',
  }),
  dates: Object.freeze({
    rootNotBefore: '2026-01-05T09:00:00Z',
    rootNotAfter: '2046-01-05T09:00:00Z',
    issuingNotBefore: '2026-01-15T10:00:00Z',
    issuingNotAfter: '2036-01-15T10:00:00Z',
    csrCreated: '2026-11-02T09:12:00Z',
    requestSubmitted: '2026-11-02T09:38:00Z',
    // ADCS backdates Not Before by 10 minutes by default to tolerate clock skew.
    leafNotBefore: '2026-11-02T09:31:00Z',
    leafIssued: '2026-11-02T09:41:00Z',
    leafNotAfter: '2027-11-02T09:41:00Z',
    issuingCrlThisUpdate: '2026-11-02T08:00:00Z',
    issuingCrlNextUpdate: '2026-11-09T20:00:00Z',
    rootCrlThisUpdate: '2026-07-01T09:00:00Z',
    rootCrlNextUpdate: '2027-07-01T09:00:00Z',
    // The fixed simulation clock used for every validity statement in the UI.
    simulationClock: '2026-11-02T09:45:00Z',
  }),
});

/** Fixture file layout, relative to the repository root. */
export const FIXTURE_FILES = Object.freeze({
  rootDer: 'fixtures/certificates/simsi2027-root-ca.cer',
  rootPem: 'fixtures/certificates/simsi2027-root-ca.pem',
  issuingDer: 'fixtures/certificates/simsi2027-issuing-ca-01.cer',
  issuingPem: 'fixtures/certificates/simsi2027-issuing-ca-01.pem',
  leafDer: 'fixtures/certificates/app-simsi2027-test.cer',
  leafPem: 'fixtures/certificates/app-simsi2027-test.pem',
  chainPem: 'fixtures/certificates/app-simsi2027-test-chain.pem',
  csrDer: 'fixtures/requests/app01-request.der',
  csrPem: 'fixtures/requests/app01-request.csr',
  requestInf: 'fixtures/requests/app01-request.inf',
  issuingCrlDer: 'fixtures/crl/simsi2027-issuing-ca-01.crl',
  issuingCrlPem: 'fixtures/crl/simsi2027-issuing-ca-01.crl.pem',
  rootCrlDer: 'fixtures/crl/simsi2027-root-ca.crl',
  manifest: 'fixtures/manifest.json',
});
