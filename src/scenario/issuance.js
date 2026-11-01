// The manual issuance flow, as data. Locations are logical places, not icons:
// app = APP01, lane = carried by the Administrator, ca = ICA01, root = offline Root CA.

import { SCENARIO } from './scenario.js';

export const LEARNING_NOTE = 'Shown for learning; never executed by this simulator.';

export const ACTORS = Object.freeze({
  administrator: {
    id: 'administrator',
    name: SCENARIO.administrator,
    role: 'Administrator',
    does: 'Runs the commands and carries the CSR. Not the certificate identity.',
  },
  app: {
    id: 'app',
    name: SCENARIO.requestingMachine,
    role: 'Requesting machine',
    does: 'Creates and keeps the private key. Builds and signs the CSR. Receives the certificate.',
  },
  ca: {
    id: 'ca',
    name: SCENARIO.issuingCa,
    host: SCENARIO.issuingCaHost,
    role: 'Issuing CA',
    does: 'Evaluates the request, creates a new certificate and signs it with its own private key.',
  },
  root: {
    id: 'root',
    name: SCENARIO.rootCa,
    role: 'Offline Root CA',
    does: 'Signed the Issuing CA certificate in January 2026. Takes no part in this issuance.',
  },
});

export const EVALUATION_CHECKS = Object.freeze([
  { id: 'received', label: 'Request received', detail: `Request ID ${SCENARIO.requestId} assigned. Requester: ${SCENARIO.administrator}` },
  { id: 'signature', label: 'Request signature', detail: 'Verified with the public key inside the CSR. Proof of possession accepted.' },
  { id: 'authorization', label: 'Requester authorization', detail: `${SCENARIO.administrator} holds Enroll on ${SCENARIO.template}` },
  { id: 'template', label: 'Template and policy', detail: `${SCENARIO.template}: subject supplied in the request` },
  { id: 'names', label: 'Subject and SAN', detail: 'app.simsi2027.test, www.app.simsi2027.test: allowed' },
  { id: 'key', label: 'Key algorithm and size', detail: 'RSA 2048 meets the template minimum' },
  { id: 'purpose', label: 'Requested purpose', detail: 'Server Authentication: permitted by template' },
  { id: 'approval', label: 'Approval requirement', detail: 'No CA manager approval required by this template (configuration-dependent)' },
  { id: 'decision', label: 'Decision', detail: 'Approved. Issue a new certificate.' },
]);

export const VERIFICATION_CHECKS = Object.freeze([
  { id: 'key', label: 'Private key', detail: 'Present on APP01 and paired with the certificate' },
  { id: 'publicKey', label: 'Public key matches CSR', detail: 'SPKI fingerprints identical' },
  { id: 'subject', label: 'Subject', detail: 'CN=app.simsi2027.test' },
  { id: 'san', label: 'SAN', detail: 'app.simsi2027.test, www.app.simsi2027.test' },
  { id: 'eku', label: 'Enhanced Key Usage', detail: 'Server Authentication' },
  { id: 'ku', label: 'Key Usage', detail: 'Digital Signature, Key Encipherment (critical)' },
  { id: 'validity', label: 'Validity', detail: 'Inside the window at the simulation clock' },
  { id: 'issuer', label: 'Issuer', detail: SCENARIO.issuingCa },
  { id: 'signature', label: 'Signature', detail: 'Verifies with the Issuing CA public key' },
  { id: 'chain', label: 'Chain', detail: `app.simsi2027.test → ${SCENARIO.issuingCa} → ${SCENARIO.rootCa}` },
  { id: 'trust', label: 'Root trust', detail: `${SCENARIO.rootCa} is in Trusted Root Certification Authorities` },
  { id: 'revocation', label: 'Revocation information', detail: 'CDP reachable; CRL 42 signed by the Issuing CA; serial not listed' },
]);

/**
 * Eight flow stages. `participants` lists the actors active in the stage; the
 * Root CA is never one. `keyAt` is where APP01's private key is: always app.
 */
export const FLOW_STAGES = Object.freeze([
  {
    id: 'created', step: 4, title: 'CSR created',
    caption: 'On APP01, the request command generates a new key pair. The private key goes into APP01\'s machine key store. The public key, subject and requested extensions go into a CSR signed with that private key.',
    participants: ['administrator', 'app'], keyAt: 'app', csrAt: 'app', certAt: null,
    command: { host: 'APP01', text: 'certreq -new -machine app01-request.inf app01-request.csr' },
  },
  {
    id: 'submitted', step: 4, title: 'CSR submitted',
    caption: 'The Administrator carries the CSR file to the Issuing CA and submits it. Only public request data travels. The private key stays on APP01.',
    participants: ['administrator', 'ca'], keyAt: 'app', csrAt: 'ca', certAt: null,
    command: { host: 'Administrator workstation', text: `certreq -submit -config "${SCENARIO.caConfig}" app01-request.csr` },
  },
  {
    id: 'evaluated', step: 5, title: 'Request evaluated',
    caption: 'The Issuing CA checks the request signature, the requester\'s permission and the template rules before deciding.',
    participants: ['ca'], keyAt: 'app', csrAt: 'ca', certAt: null,
    command: null,
  },
  {
    id: 'issued', step: 5, title: 'Certificate issued',
    caption: 'The CA builds a separate, new certificate. Approved request values are copied in, CA-controlled fields are added, and the Issuing CA private key signs it. The Root CA stays offline.',
    participants: ['ca'], keyAt: 'app', csrAt: 'ca', certAt: 'ca',
    command: null,
  },
  {
    id: 'returned', step: 6, title: 'Certificate returned',
    caption: 'The Administrator retrieves the issued certificate and copies it back to APP01. It is public, so it can travel freely.',
    participants: ['administrator', 'app'], keyAt: 'app', csrAt: 'ca', certAt: 'app',
    command: { host: 'Administrator workstation', text: `certreq -retrieve -config "${SCENARIO.caConfig}" ${SCENARIO.requestId} app-simsi2027-test.cer` },
  },
  {
    id: 'installed', step: 6, title: 'Certificate installed',
    caption: 'On APP01, accepting the certificate places it in Certificates (Local Computer) › Personal › Certificates and clears the pending request.',
    participants: ['administrator', 'app'], keyAt: 'app', csrAt: 'ca', certAt: 'store',
    command: { host: 'APP01', text: 'certreq -accept -machine app-simsi2027-test.cer' },
  },
  {
    id: 'matched', step: 6, title: 'Private key matched',
    caption: 'Windows links the certificate to the private key created with the CSR, because their public keys match. The key never moved.',
    participants: ['app'], keyAt: 'app', csrAt: 'ca', certAt: 'store',
    command: null,
  },
  {
    id: 'verified', step: 7, title: 'Certificate verified',
    caption: 'The Administrator verifies the key pairing, names, purposes, dates, signature, chain, root trust and revocation information.',
    participants: ['administrator', 'app'], keyAt: 'app', csrAt: 'ca', certAt: 'store',
    command: { host: 'APP01', text: 'certutil -store My app.simsi2027.test\ncertutil -verify -urlfetch app-simsi2027-test.cer' },
  },
]);

export const FLOW_STAGE_IDS = FLOW_STAGES.map((s) => s.id);
