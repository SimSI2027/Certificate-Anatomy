#!/usr/bin/env node
// Generates the synthetic public PKI fixtures for Certificate Anatomy.
//
// Private keys are generated in memory with Node's crypto module, used to sign,
// and discarded when the process exits. No key is ever written to disk.
//
// Everything except key material is deterministic: names, dates, serial numbers,
// extensions and file layout are fixed. Regenerating therefore produces
// structurally identical artifacts with new keys and signatures. A seeded key
// generator was rejected on purpose: committing a seed would be equivalent to
// committing the private keys.

import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  seq, setOf, ctxCons, ctxPrim, integer, integerHex, oid, nullValue, bool, octets,
  utf8, ia5, bmp, bitString, namedBits, time,
} from './der-encode.mjs';
import { SCENARIO, FIXTURE_FILES } from '../../src/scenario/scenario.js';
import { OID } from '../../src/asn1/oids.js';
import { derToPem } from '../../src/asn1/der.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const D = (iso) => new Date(iso);
const sha = (alg, buf) => createHash(alg).update(buf).digest();

/** Deterministic positive serial derived from a label (CA-chosen, not secret). */
function serialFor(label, bytes) {
  const h = sha('sha256', Buffer.from(`SIMSI2027 serial:${label}`));
  const s = Buffer.from(h.subarray(0, bytes));
  s[0] = (s[0] & 0x7f) | 0x10; // positive, no leading zero byte
  return s.toString('hex');
}

function newRsaKey(bits) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: bits, publicExponent: 0x10001 });
  return { privateKey, spki: publicKey.export({ type: 'spki', format: 'der' }) };
}

/** subjectPublicKey BIT STRING contents (excluding the unused-bits byte). */
function spkiKeyBits(spki) {
  // SPKI = SEQUENCE { AlgorithmIdentifier, BIT STRING }. Walk the DER manually.
  let p = 0;
  const readLen = () => {
    let len = spki[p++];
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let i = 0; i < n; i++) len = len * 256 + spki[p++];
    }
    return len;
  };
  p++; readLen(); // outer SEQUENCE
  p++; p += readLen(); // AlgorithmIdentifier
  p++; const bitLen = readLen();
  return spki.subarray(p + 1, p + bitLen);
}

const keyIdOf = (spki) => sha('sha1', spkiKeyBits(spki)); // RFC 5280 method 1

const name = (cn, o) =>
  seq(
    setOf(seq(oid(OID.organizationName), utf8(o))),
    setOf(seq(oid(OID.commonName), utf8(cn))),
  );

const sigAlg = () => seq(oid(OID.sha256WithRSAEncryption), nullValue());

const ext = (id, critical, value) =>
  critical ? seq(oid(id), bool(true), octets(value)) : seq(oid(id), octets(value));

const exts = {
  san: (names) => ext(OID.subjectAltName, false, seq(...names.map((n) => ctxPrim(2, Buffer.from(n, 'ascii'))))),
  ku: (bits) => ext(OID.keyUsage, true, namedBits(bits)),
  eku: (oids) => ext(OID.extKeyUsage, false, seq(...oids.map(oid))),
  bc: (isCa, pathLen) =>
    ext(OID.basicConstraints, true, isCa ? seq(bool(true), ...(pathLen === undefined ? [] : [integer(pathLen)])) : seq()),
  ski: (spki) => ext(OID.subjectKeyIdentifier, false, octets(keyIdOf(spki))),
  aki: (issuerSpki) => ext(OID.authorityKeyIdentifier, false, seq(ctxPrim(0, keyIdOf(issuerSpki)))),
  aia: (url) => ext(OID.authorityInfoAccess, false, seq(seq(oid(OID.caIssuers), ctxPrim(6, Buffer.from(url, 'ascii'))))),
  cdp: (url) =>
    ext(OID.cRLDistributionPoints, false, seq(seq(ctxCons(0, ctxCons(0, ctxPrim(6, Buffer.from(url, 'ascii'))))))),
};

function buildCertificate({ serialHex, issuerName, subjectName, notBefore, notAfter, spki, extensions, signerKey }) {
  const tbs = seq(
    ctxCons(0, integer(2)), // v3
    integerHex(serialHex),
    sigAlg(),
    issuerName,
    seq(time(notBefore), time(notAfter)),
    subjectName,
    spki,
    ctxCons(3, seq(...extensions)),
  );
  const signature = sign('sha256', tbs, signerKey);
  return seq(tbs, sigAlg(), bitString(signature));
}

function buildCrl({ issuerName, thisUpdate, nextUpdate, issuerSpki, crlNumber, signerKey }) {
  const tbs = seq(
    integer(1), // v2
    sigAlg(),
    issuerName,
    time(thisUpdate),
    time(nextUpdate),
    // No revokedCertificates: nothing issued by this CA has been revoked.
    ctxCons(0, seq(
      seq(oid(OID.authorityKeyIdentifier), octets(seq(ctxPrim(0, keyIdOf(issuerSpki))))),
      seq(oid(OID.cRLNumber), octets(integer(crlNumber))),
    )),
  );
  return seq(tbs, sigAlg(), bitString(sign('sha256', tbs, signerKey)));
}

function fingerprints(der) {
  return {
    sha1: sha('sha1', der).toString('hex').toUpperCase(),
    sha256: sha('sha256', der).toString('hex').toUpperCase(),
  };
}

function write(rel, data) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, data);
  return rel;
}

const REQUEST_INF = `; app01-request.inf
; Synthetic request policy for APP01.simsi2027.test.
; Shown for learning; never executed by this simulator.
;
; Conceptually, "certreq -new -machine app01-request.inf app01-request.csr"
; generates a new RSA 2048 key pair inside APP01's machine key store,
; builds a PKCS #10 request from the values below and signs it with the
; new private key. The private key stays on APP01. The checked-in CSR was
; generated by scripts/fixtures/generate.mjs, not by certreq.

[Version]
Signature = "$Windows NT$"

[NewRequest]
Subject = "CN=${SCENARIO.service}, O=${SCENARIO.organization}"
KeyAlgorithm = RSA
KeyLength = 2048
HashAlgorithm = SHA256
MachineKeySet = TRUE
Exportable = FALSE
KeyUsage = 0xA0            ; Digital Signature, Key Encipherment
RequestType = PKCS10

[EnhancedKeyUsageExtension]
OID = ${OID.serverAuth}    ; Server Authentication

[Extensions]
${OID.subjectAltName} = "{text}"
_continue_ = "dns=${SCENARIO.service}&"
_continue_ = "dns=${SCENARIO.additionalSan}"

[RequestAttributes]
CertificateTemplate = ${SCENARIO.template}
`;

function main() {
  const t = SCENARIO.dates;
  const rootKey = newRsaKey(4096);
  const issuingKey = newRsaKey(4096);
  const appKey = newRsaKey(2048); // APP01's key: exists only inside this process

  const rootName = name(SCENARIO.rootCa, SCENARIO.organization);
  const issuingName = name(SCENARIO.issuingCa, SCENARIO.organization);
  const leafName = name(SCENARIO.service, SCENARIO.organization);

  const serials = {
    root: serialFor('root', 16),
    issuing: serialFor('issuing-ca-01', 16),
    leaf: serialFor(`leaf-request-${SCENARIO.requestId}`, 16),
  };

  // Root CA: self-signed trust anchor. Offline after it signs the Issuing CA.
  const rootDer = buildCertificate({
    serialHex: serials.root,
    issuerName: rootName,
    subjectName: rootName,
    notBefore: D(t.rootNotBefore),
    notAfter: D(t.rootNotAfter),
    spki: rootKey.spki,
    extensions: [exts.ku([0, 5, 6]), exts.bc(true), exts.ski(rootKey.spki)],
    signerKey: rootKey.privateKey,
  });

  // Issuing CA certificate: signed by the Root CA in January 2026.
  const issuingDer = buildCertificate({
    serialHex: serials.issuing,
    issuerName: rootName,
    subjectName: issuingName,
    notBefore: D(t.issuingNotBefore),
    notAfter: D(t.issuingNotAfter),
    spki: issuingKey.spki,
    extensions: [
      exts.ku([0, 5, 6]),
      exts.bc(true, 0),
      exts.ski(issuingKey.spki),
      exts.aki(rootKey.spki),
      exts.aia(SCENARIO.urls.rootAia),
      exts.cdp(SCENARIO.urls.rootCdp),
    ],
    signerKey: rootKey.privateKey,
  });

  // CSR: built and signed on APP01 with APP01's private key (proof of possession).
  const extensionRequest = seq(
    oid(OID.extensionRequest),
    setOf(seq(
      exts.san([SCENARIO.service, SCENARIO.additionalSan]),
      exts.ku([0, 2]),
      exts.eku([OID.serverAuth]),
    )),
  );
  const templateAttribute = seq(
    oid(OID.enrollmentNameValuePair),
    setOf(seq(bmp('CertificateTemplate'), bmp(SCENARIO.template))),
  );
  const cri = seq(
    integer(0),
    leafName,
    appKey.spki,
    ctxCons(0, Buffer.concat([extensionRequest, templateAttribute].sort(Buffer.compare))),
  );
  const csrDer = seq(cri, sigAlg(), bitString(sign('sha256', cri, appKey.privateKey)));

  // Leaf: a NEW structure created by the Issuing CA. Approved request values are
  // copied in; CA-controlled values are added; the Issuing CA key signs it.
  const leafDer = buildCertificate({
    serialHex: serials.leaf,
    issuerName: issuingName,
    subjectName: leafName,
    notBefore: D(t.leafNotBefore),
    notAfter: D(t.leafNotAfter),
    spki: appKey.spki,
    extensions: [
      exts.san([SCENARIO.service, SCENARIO.additionalSan]),
      exts.ku([0, 2]),
      exts.eku([OID.serverAuth]),
      exts.bc(false),
      exts.ski(appKey.spki),
      exts.aki(issuingKey.spki),
      exts.aia(SCENARIO.urls.issuingAia),
      exts.cdp(SCENARIO.urls.issuingCdp),
    ],
    signerKey: issuingKey.privateKey,
  });

  const issuingCrl = buildCrl({
    issuerName: issuingName,
    thisUpdate: D(t.issuingCrlThisUpdate),
    nextUpdate: D(t.issuingCrlNextUpdate),
    issuerSpki: issuingKey.spki,
    crlNumber: 42,
    signerKey: issuingKey.privateKey,
  });
  const rootCrl = buildCrl({
    issuerName: rootName,
    thisUpdate: D(t.rootCrlThisUpdate),
    nextUpdate: D(t.rootCrlNextUpdate),
    issuerSpki: rootKey.spki,
    crlNumber: 3,
    signerKey: rootKey.privateKey,
  });

  const F = FIXTURE_FILES;
  write(F.rootDer, rootDer);
  write(F.rootPem, derToPem(rootDer, 'CERTIFICATE'));
  write(F.issuingDer, issuingDer);
  write(F.issuingPem, derToPem(issuingDer, 'CERTIFICATE'));
  write(F.leafDer, leafDer);
  write(F.leafPem, derToPem(leafDer, 'CERTIFICATE'));
  write(F.chainPem, [leafDer, issuingDer, rootDer].map((d) => derToPem(d, 'CERTIFICATE')).join(''));
  write(F.csrDer, csrDer);
  write(F.csrPem, derToPem(csrDer, 'CERTIFICATE REQUEST'));
  write(F.requestInf, REQUEST_INF.replace(/\n/g, '\r\n'));
  write(F.issuingCrlDer, issuingCrl);
  write(F.issuingCrlPem, derToPem(issuingCrl, 'X509 CRL'));
  write(F.rootCrlDer, rootCrl);

  const spkiHash = (spki) => sha('sha256', spki).toString('hex').toUpperCase();
  const manifest = {
    project: 'Certificate Anatomy',
    synthetic: true,
    note: 'Entirely synthetic public artifacts. Private keys were generated in memory and discarded; none are distributed.',
    simulationClock: t.simulationClock,
    scenario: {
      administrator: SCENARIO.administrator,
      requestingMachine: SCENARIO.requestingMachine,
      service: SCENARIO.service,
      issuingCa: SCENARIO.issuingCa,
      issuingCaHost: SCENARIO.issuingCaHost,
      rootCa: SCENARIO.rootCa,
      template: SCENARIO.template,
      requestId: SCENARIO.requestId,
      caConfig: SCENARIO.caConfig,
    },
    artifacts: {
      rootCa: {
        kind: 'certificate', role: 'Offline Root CA (self-signed trust anchor)',
        der: F.rootDer, pem: F.rootPem, serial: serials.root.toUpperCase(),
        subject: `CN=${SCENARIO.rootCa}, O=${SCENARIO.organization}`,
        issuer: `CN=${SCENARIO.rootCa}, O=${SCENARIO.organization}`,
        notBefore: t.rootNotBefore, notAfter: t.rootNotAfter, keyAlgorithm: 'RSA 4096',
        spkiSha256: spkiHash(rootKey.spki), thumbprints: fingerprints(rootDer), signedBy: 'rootCa',
      },
      issuingCa: {
        kind: 'certificate', role: 'Enterprise Issuing CA / SubCA',
        der: F.issuingDer, pem: F.issuingPem, serial: serials.issuing.toUpperCase(),
        subject: `CN=${SCENARIO.issuingCa}, O=${SCENARIO.organization}`,
        issuer: `CN=${SCENARIO.rootCa}, O=${SCENARIO.organization}`,
        notBefore: t.issuingNotBefore, notAfter: t.issuingNotAfter, keyAlgorithm: 'RSA 4096',
        spkiSha256: spkiHash(issuingKey.spki), thumbprints: fingerprints(issuingDer), signedBy: 'rootCa',
      },
      request: {
        kind: 'pkcs10', role: 'Manual CSR created and signed on APP01',
        der: F.csrDer, pem: F.csrPem, policy: F.requestInf,
        subject: `CN=${SCENARIO.service}, O=${SCENARIO.organization}`,
        keyAlgorithm: 'RSA 2048', spkiSha256: spkiHash(appKey.spki),
        createdOn: SCENARIO.requestingMachine, created: t.csrCreated, signedBy: 'APP01 private key (self-signature, proof of possession)',
      },
      leaf: {
        kind: 'certificate', role: 'Issued TLS server certificate for app.simsi2027.test',
        der: F.leafDer, pem: F.leafPem, chain: F.chainPem, serial: serials.leaf.toUpperCase(),
        subject: `CN=${SCENARIO.service}, O=${SCENARIO.organization}`,
        issuer: `CN=${SCENARIO.issuingCa}, O=${SCENARIO.organization}`,
        notBefore: t.leafNotBefore, notAfter: t.leafNotAfter, issued: t.leafIssued, keyAlgorithm: 'RSA 2048',
        spkiSha256: spkiHash(appKey.spki), thumbprints: fingerprints(leafDer), signedBy: 'issuingCa',
        issuedFromRequest: 'request', requestId: SCENARIO.requestId,
      },
      issuingCrl: {
        kind: 'crl', role: 'CRL published by SIMSI2027 Issuing CA 01 (no revoked entries)',
        der: F.issuingCrlDer, pem: F.issuingCrlPem, thisUpdate: t.issuingCrlThisUpdate,
        nextUpdate: t.issuingCrlNextUpdate, crlNumber: 42, signedBy: 'issuingCa',
      },
      rootCrl: {
        kind: 'crl', role: 'CRL published by the offline Root CA (no revoked entries)',
        der: F.rootCrlDer, thisUpdate: t.rootCrlThisUpdate, nextUpdate: t.rootCrlNextUpdate,
        crlNumber: 3, signedBy: 'rootCa',
      },
    },
    chain: ['leaf', 'issuingCa', 'rootCa'],
    files: Object.fromEntries(
      Object.entries({
        [F.rootDer]: rootDer, [F.issuingDer]: issuingDer, [F.leafDer]: leafDer, [F.csrDer]: csrDer,
        [F.issuingCrlDer]: issuingCrl, [F.rootCrlDer]: rootCrl,
      }).map(([k, v]) => [k, { sha256: sha('sha256', v).toString('hex').toUpperCase(), bytes: v.length }]),
    ),
  };
  write(F.manifest, JSON.stringify(manifest, null, 2) + '\n');

  console.log('Generated synthetic fixtures:');
  for (const rel of Object.values(F)) console.log('  ' + rel);
  console.log('Private keys were held in memory only and are discarded on exit.');
}

main();
