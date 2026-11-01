// Independent fixture verification. Uses Node's own X.509 parser and crypto
// wherever possible so a bug in the project's DER code cannot hide a bad fixture.

import { X509Certificate, createPublicKey, verify, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { FIXTURE_FILES as F, SCENARIO } from '../../src/scenario/scenario.js';
import { buildCertificateModel, buildCsrModel, bytesEqual } from '../../src/artifacts/model.js';
import { decodeStrict, decodeTime, pemToDer, pemBlocks, bitStringBytes, toHex } from '../../src/asn1/der.js';
import { OID } from '../../src/asn1/oids.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(ROOT, rel));
const sha = (alg, b) => createHash(alg).update(b).digest('hex').toUpperCase();

export function loadFixtures() {
  return {
    rootDer: read(F.rootDer),
    issuingDer: read(F.issuingDer),
    leafDer: read(F.leafDer),
    csrDer: read(F.csrDer),
    issuingCrlDer: read(F.issuingCrlDer),
    rootCrlDer: read(F.rootCrlDer),
    leafPem: read(F.leafPem, 'utf8').toString(),
    csrPem: read(F.csrPem).toString(),
    chainPem: read(F.chainPem).toString(),
    inf: read(F.requestInf).toString(),
    manifest: JSON.parse(read(F.manifest).toString()),
  };
}

function verifyCrl(crlDer, issuerCert) {
  const root = decodeStrict(new Uint8Array(crlDer));
  const [tbs, , sig] = root.children;
  const ok = verify('sha256', Buffer.from(tbs.bytes), issuerCert.publicKey, Buffer.from(bitStringBytes(sig)));
  const thisUpdate = decodeTime(tbs.children[3]);
  const nextUpdate = decodeTime(tbs.children[4]);
  const hasRevoked = tbs.children.some((c) => c.tagClass === 'universal' && c.tagNumber === 0x10 && c.offset > tbs.children[4].offset);
  return { ok, thisUpdate, nextUpdate, hasRevoked };
}

export function runFixtureChecks() {
  const fx = loadFixtures();
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

  const root = new X509Certificate(fx.rootDer);
  const ica = new X509Certificate(fx.issuingDer);
  const leaf = new X509Certificate(fx.leafDer);
  const clock = new Date(SCENARIO.dates.simulationClock);

  // Signatures and chain.
  check('Root CA is self-signed', root.verify(root.publicKey) && root.checkIssued(root));
  check('Issuing CA signature verifies against the Root CA', ica.verify(root.publicKey) && ica.checkIssued(root));
  check('Leaf signature verifies against the Issuing CA', leaf.verify(ica.publicKey) && leaf.checkIssued(ica));
  check('Leaf is NOT signed by the Root CA', !leaf.verify(root.publicKey));
  check('Root CA is a CA', root.ca === true);
  check('Issuing CA is a CA', ica.ca === true);
  check('Leaf is not a CA', leaf.ca === false);

  // CSR.
  const csr = buildCsrModel(new Uint8Array(fx.csrDer));
  const csrKey = createPublicKey({ key: Buffer.from(csr.spkiBytes), format: 'der', type: 'spki' });
  check('CSR signature verifies with the CSR public key (proof of possession)',
    verify('sha256', Buffer.from(csr.criBytes), csrKey, Buffer.from(csr.signatureBytes)));
  const leafModel = buildCertificateModel(new Uint8Array(fx.leafDer));
  check('CSR public key equals leaf certificate public key', bytesEqual(csr.spkiBytes, leafModel.spkiBytes));
  check('Leaf public key from Node parser equals CSR public key',
    bytesEqual(leaf.publicKey.export({ type: 'spki', format: 'der' }), csr.spkiBytes));
  check('CSR PEM decodes to the CSR DER', bytesEqual(pemToDer(fx.csrPem, 'CERTIFICATE REQUEST'), fx.csrDer));
  check('Leaf PEM decodes to the leaf DER', bytesEqual(pemToDer(fx.leafPem, 'CERTIFICATE'), fx.leafDer));
  check('CSR is PKCS #10 version 0', csr.version === 0);
  check('CSR requests SAN app + www', JSON.stringify(csr.ext.san?.data.names.map((n) => n.value)) ===
    JSON.stringify([SCENARIO.service, SCENARIO.additionalSan]));
  check('CSR requests Server Authentication EKU', csr.ext.eku?.data.purposes.join() === OID.serverAuth);
  check('CSR carries the template request attribute',
    csr.attributes.some((a) => a.oid === OID.enrollmentNameValuePair && a.pair?.[1] === SCENARIO.template));
  check('CSR does not contain CA-only fields (AIA, CDP, AKI, Basic Constraints)',
    !['aia', 'cdp', 'aki', 'bc'].some((k) => csr.ext[k]));

  // Leaf content.
  check('Leaf SAN is app + www', leaf.subjectAltName === `DNS:${SCENARIO.service}, DNS:${SCENARIO.additionalSan}`);
  check('Leaf EKU is Server Authentication only', JSON.stringify(leaf.keyUsage) === JSON.stringify([OID.serverAuth]));
  check('Leaf Key Usage is Digital Signature + Key Encipherment',
    leafModel.ext.ku?.data.usages.join() === 'Digital Signature,Key Encipherment' && leafModel.ext.ku.critical);
  check('Leaf subject is the service, not the administrator',
    leaf.subject.includes(`CN=${SCENARIO.service}`) && !leaf.subject.includes('CertificateAdmin'));
  check('Leaf issuer is the Issuing CA', leaf.issuer.includes(`CN=${SCENARIO.issuingCa}`));
  check('Leaf AKI equals Issuing CA SKI', leafModel.ext.aki?.data.keyId ===
    buildCertificateModel(new Uint8Array(fx.issuingDer)).ext.ski?.data.keyId);
  check('Leaf AIA points to the Issuing CA certificate', leafModel.ext.aia?.data.entries[0].location === SCENARIO.urls.issuingAia);
  check('Leaf CDP points to the Issuing CA CRL', leafModel.ext.cdp?.data.urls[0] === SCENARIO.urls.issuingCdp);
  check('AIA and CDP are separate extensions with different locations',
    leafModel.ext.aia && leafModel.ext.cdp && leafModel.ext.aia.data.entries[0].location !== leafModel.ext.cdp.data.urls[0]);

  // Dates.
  const nb = new Date(leaf.validFrom), na = new Date(leaf.validTo);
  check('Leaf validity contains the simulation clock', nb <= clock && clock <= na);
  check('Leaf validity lies inside the Issuing CA validity', new Date(ica.validFrom) <= nb && na <= new Date(ica.validTo));
  check('Issuing CA validity lies inside the Root validity',
    new Date(root.validFrom) <= new Date(ica.validFrom) && new Date(ica.validTo) <= new Date(root.validTo));
  check('CSR was created before the leaf was issued',
    new Date(SCENARIO.dates.csrCreated) < new Date(SCENARIO.dates.leafIssued));

  // Chain file.
  const chain = pemBlocks(fx.chainPem);
  check('Chain file is leaf, Issuing CA, Root in order', chain.length === 3 &&
    bytesEqual(chain[0].der, fx.leafDer) && bytesEqual(chain[1].der, fx.issuingDer) && bytesEqual(chain[2].der, fx.rootDer));

  // CRLs.
  const icrl = verifyCrl(fx.issuingCrlDer, ica);
  check('Issuing CA CRL is signed by the Issuing CA', icrl.ok);
  check('Issuing CA CRL is current at the simulation clock', icrl.thisUpdate <= clock && clock <= icrl.nextUpdate);
  check('Issuing CA CRL lists no revoked certificates', !icrl.hasRevoked);
  const rcrl = verifyCrl(fx.rootCrlDer, root);
  check('Root CA CRL is signed by the Root CA', rcrl.ok && rcrl.thisUpdate <= clock && clock <= rcrl.nextUpdate);

  // Manifest.
  const m = fx.manifest;
  check('Manifest leaf SHA-1 thumbprint matches', m.artifacts.leaf.thumbprints.sha1 === sha('sha1', fx.leafDer));
  check('Manifest leaf SHA-256 thumbprint matches', m.artifacts.leaf.thumbprints.sha256 === sha('sha256', fx.leafDer));
  check('Manifest serial matches the leaf', m.artifacts.leaf.serial === leaf.serialNumber.toUpperCase());
  check('Manifest file hashes match', Object.entries(m.files).every(([p, v]) => sha('sha256', read(p)) === v.sha256));
  check('Manifest SPKI hashes link CSR and leaf', m.artifacts.request.spkiSha256 === m.artifacts.leaf.spkiSha256 &&
    m.artifacts.leaf.spkiSha256 === sha('sha256', Buffer.from(csr.spkiBytes)));

  // Request policy file.
  check('Request INF carries the learning disclaimer', fx.inf.includes('Shown for learning; never executed by this simulator.'));
  check('Request INF contains no secrets', !/password|BEGIN .*PRIVATE KEY/i.test(fx.inf));

  // OpenSSL cross-check when available (always present on GitHub runners).
  const openssl = findOpenssl();
  if (openssl) {
    try {
      const out = execFileSync(openssl, ['req', '-in', join(ROOT, F.csrPem), '-noout', '-verify'], { stdio: 'pipe' }).toString() +
        '';
      check('OpenSSL verifies the CSR self-signature', true, out.trim());
    } catch (e) {
      const msg = `${e.stdout || ''}${e.stderr || ''}`;
      check('OpenSSL verifies the CSR self-signature', /verify OK/i.test(msg), msg.trim());
    }
  }
  return checks;
}

function findOpenssl() {
  try {
    execFileSync('openssl', ['version'], { stdio: 'pipe' });
    return 'openssl';
  } catch {
    const git = 'C:/Program Files/Git/usr/bin/openssl.exe';
    return existsSync(git) ? git : null;
  }
}

export { toHex };
