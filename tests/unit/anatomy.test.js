import { describe, it, expect } from 'vitest';
import { nodeContext } from '../helpers/context.js';
import { CERTIFICATE_FIELDS } from '../../src/anatomy/certificate-fields.js';
import { CSR_FIELDS } from '../../src/anatomy/csr-fields.js';
import { CATEGORIES } from '../../src/anatomy/categories.js';
import { RELATIONSHIPS, relationForNode } from '../../src/anatomy/relationships.js';

const ctx = nodeContext();
const ids = (tree, out = []) => { out.push(tree.id); tree.children.forEach((c) => ids(c, out)); return out; };
const CERT_IDS = ids(ctx.trees.cert);
const CSR_IDS = ids(ctx.trees.csr);

describe('certificate structure (X.509)', () => {
  it('has exactly the RFC 5280 TBSCertificate fields in order', () => {
    expect(ctx.trees.cert.children.map((c) => c.id)).toEqual(['cert.tbs', 'cert.sigAlg', 'cert.sigValue']);
    expect(ctx.index.get('cert.tbs').children.map((c) => c.id)).toEqual([
      'cert.tbs.version', 'cert.tbs.serial', 'cert.tbs.signature', 'cert.tbs.issuer', 'cert.tbs.validity',
      'cert.tbs.subject', 'cert.tbs.spki', 'cert.tbs.extensions']);
  });
  it('has the eight teaching extensions, all parsed from the fixture', () => {
    expect(ctx.index.get('cert.tbs.extensions').children.map((c) => c.id)).toEqual([
      'cert.ext.san', 'cert.ext.ku', 'cert.ext.eku', 'cert.ext.bc', 'cert.ext.ski', 'cert.ext.aki', 'cert.ext.aia', 'cert.ext.cdp']);
  });
  it('every node has a byte range inside the DER', () => {
    for (const id of CERT_IDS) {
      const [a, b] = ctx.index.get(id).range;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(ctx.bytes.cert.length);
    }
  });
});

describe('CSR structure (PKCS #10)', () => {
  it('matches CertificationRequest -> Info / algorithm / signature', () => {
    expect(ctx.trees.csr.children.map((c) => c.id)).toEqual(['csr.cri', 'csr.sigAlg', 'csr.sigValue']);
    expect(ctx.index.get('csr.cri').children.map((c) => c.id)).toEqual([
      'csr.cri.version', 'csr.cri.subject', 'csr.cri.spki', 'csr.cri.attributes']);
    expect(ctx.index.get('csr.cri.spki').children.map((c) => c.id)).toEqual(['csr.cri.spki.algorithm', 'csr.cri.spki.publicKey']);
  });
  it('keeps the Extension Request under Attributes with SAN, KU and EKU', () => {
    expect(ctx.index.get('csr.cri.attributes').children.map((c) => c.id)).toContain('csr.attr.extReq');
    expect(ctx.index.get('csr.attr.extReq').children.map((c) => c.id)).toEqual(['csr.ext.san', 'csr.ext.ku', 'csr.ext.eku']);
  });
  it('represents the template as a separate attribute, not an extension', () => {
    expect(ctx.index.get('csr.cri.attributes').children.map((c) => c.id)).toContain('csr.attr.template');
    expect(ctx.index.get('csr.attr.extReq').children.map((c) => c.id)).not.toContain('csr.attr.template');
  });
  it('has no private key node inside the CSR tree', () => {
    expect(CSR_IDS.some((id) => /private/i.test(id))).toBe(false);
    expect(ctx.node('csr.privateKey').parentId).toBeNull();
  });
});

describe('field definitions', () => {
  const REQUIRED = ['what', 'why', 'who', 'security', 'relationship', 'failure', 'facts'];
  it('every certificate node has a complete definition', () => {
    for (const id of [...CERT_IDS, 'cert.thumbprint']) {
      const d = CERTIFICATE_FIELDS[id];
      expect(d, id).toBeTruthy();
      for (const k of REQUIRED) expect(d[k], `${id}.${k}`).toBeTruthy();
      for (const k of ['fromCsr', 'signed', 'secret']) expect(d.facts[k], `${id}.facts.${k}`).toBeTruthy();
    }
  });
  it('every CSR node and the private key have a complete definition', () => {
    for (const id of [...CSR_IDS, 'csr.privateKey']) {
      const d = CSR_FIELDS[id];
      expect(d, id).toBeTruthy();
      for (const k of REQUIRED) expect(d[k], `${id}.${k}`).toBeTruthy();
      for (const k of ['signed', 'secret', 'travels']) expect(d.facts[k], `${id}.facts.${k}`).toBeTruthy();
    }
  });
  it('uses only known source categories', () => {
    for (const d of Object.values(CERTIFICATE_FIELDS)) if (d.category) expect(CATEGORIES[d.category]).toBeTruthy();
  });
  it('classifies certificate-only fields as CA-controlled, never approved', () => {
    for (const id of ['cert.tbs.serial', 'cert.tbs.issuer', 'cert.tbs.validity', 'cert.ext.bc']) {
      expect(CERTIFICATE_FIELDS[id].category).toBe('added');
    }
    for (const id of ['cert.ext.aia', 'cert.ext.cdp']) expect(CERTIFICATE_FIELDS[id].category).toBe('config');
    for (const id of ['cert.ext.ski', 'cert.ext.aki', 'cert.sigValue']) expect(CERTIFICATE_FIELDS[id].category).toBe('derived');
  });
  it('classifies request-derived fields as approved', () => {
    for (const id of ['cert.tbs.subject', 'cert.tbs.spki', 'cert.ext.san', 'cert.ext.ku', 'cert.ext.eku']) {
      expect(CERTIFICATE_FIELDS[id].category).toBe('approved');
    }
  });
  it('states the private key is secret and never travels; CSR fields are not secret', () => {
    expect(CSR_FIELDS['csr.privateKey'].facts.travels).toMatch(/^No/);
    expect(CSR_FIELDS['csr.privateKey'].facts.secret).toMatch(/^Yes/);
    for (const id of CSR_IDS) expect(CSR_FIELDS[id].facts.secret, id).toMatch(/^No/);
  });
  it('separates AIA from revocation and CDP from issuer certificates', () => {
    expect(CERTIFICATE_FIELDS['cert.ext.aia'].security).toMatch(/Not revocation/);
    expect(CERTIFICATE_FIELDS['cert.ext.cdp'].security).toMatch(/Separate from AIA/);
  });
  it('says the CSR signature is not copied and the certificate signature is not made by APP01', () => {
    expect(CSR_FIELDS['csr.sigValue'].relationship).toMatch(/not copied/);
    expect(CERTIFICATE_FIELDS['cert.sigValue'].who).toMatch(/Not produced by APP01/);
  });
  it('never claims the requester can force an EKU', () => {
    expect(CSR_FIELDS['csr.ext.eku'].security).toMatch(/cannot force/);
  });
  it('says the issuer is not the Root CA', () => {
    expect(CERTIFICATE_FIELDS['cert.tbs.issuer'].security).toMatch(/Not the Root CA/);
  });
});

describe('relationships', () => {
  it('link exactly the five request-derived fields', () => {
    const linked = RELATIONSHIPS.filter((r) => r.csr && r.cert).map((r) => r.id).sort();
    expect(linked).toEqual(['eku', 'ku', 'san', 'spki', 'subject']);
  });
  it('mark CA-only fields with no CSR source', () => {
    for (const id of ['serial', 'issuer', 'validity', 'aia', 'cdp', 'certsig']) {
      expect(RELATIONSHIPS.find((r) => r.id === id).csr).toBeNull();
    }
  });
  it('give the CSR signature no certificate field', () => {
    const r = RELATIONSHIPS.find((x) => x.id === 'csrsig');
    expect(r.cert).toBeNull();
    expect(r.classification).toMatch(/prove key possession/);
  });
  it('reference only nodes that exist', () => {
    for (const r of RELATIONSHIPS) {
      if (r.csr) expect(ctx.node(r.csr), r.csr).toBeTruthy();
      if (r.cert) expect(ctx.node(r.cert), r.cert).toBeTruthy();
    }
  });
  it('trace backward and forward', () => {
    expect(relationForNode('cert.tbs.spki.publicKey').csr).toBe('csr.cri.spki');
    expect(relationForNode('csr.ext.san').cert).toBe('cert.ext.san');
  });
});

describe('parsed values', () => {
  it('fingerprints prove CSR and certificate share one public key', () => {
    expect(ctx.fingerprints.spkiMatch).toBe(true);
    expect(ctx.fingerprints.csrSpkiSha256).toBe(ctx.manifest.artifacts.request.spkiSha256);
    expect(ctx.fingerprints.certSha1).toBe(ctx.manifest.artifacts.leaf.thumbprints.sha1);
  });
  it('reads real SAN, EKU and issuer values', () => {
    expect(ctx.node('cert.ext.san').value).toContain('www.app.simsi2027.test');
    expect(ctx.node('cert.ext.eku').value).toContain('Server Authentication');
    expect(ctx.node('cert.tbs.issuer').value).toContain('SIMSI2027 Issuing CA 01');
    expect(ctx.node('cert.tbs.issuer').value).not.toContain('Root');
  });
});
