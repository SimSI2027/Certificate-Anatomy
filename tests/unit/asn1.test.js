import { describe, it, expect } from 'vitest';
import { decodeStrict, decodeOid, toBase64, fromBase64, derToPem, pemToDer, pemBlocks } from '../../src/asn1/der.js';
import { sha1Hex, sha256Hex } from '../../src/crypto/hash.js';
import { createHash } from 'node:crypto';
import { asn1Outline } from '../../src/inspectors/asn1-outline.js';

describe('DER decoder', () => {
  it('decodes nested TLVs with exact byte ranges', () => {
    const der = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x05, 0x01, 0x01, 0xff]);
    const n = decodeStrict(der);
    expect(n.children).toHaveLength(2);
    expect(n.children[0].offset).toBe(2);
    expect(n.children[1].end).toBe(8);
  });
  it('rejects trailing bytes', () => {
    expect(() => decodeStrict(new Uint8Array([0x05, 0x00, 0x00]))).toThrow();
  });
  it('decodes OIDs', () => {
    expect(decodeOid(new Uint8Array([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b]))).toBe('1.2.840.113549.1.1.11');
  });
  it('round-trips Base64 and PEM', () => {
    const b = new Uint8Array(Array.from({ length: 200 }, (_, i) => (i * 37) & 255));
    expect(Buffer.from(fromBase64(toBase64(b)))).toEqual(Buffer.from(b));
    expect(toBase64(b)).toBe(Buffer.from(b).toString('base64'));
    const pem = derToPem(b, 'TEST');
    expect(Buffer.from(pemToDer(pem, 'TEST'))).toEqual(Buffer.from(b));
    expect(pemBlocks(pem + pem)).toHaveLength(2);
  });
});

describe('in-browser hashes', () => {
  it('match Node crypto for SHA-1 and SHA-256', () => {
    for (const len of [0, 1, 55, 56, 64, 1000]) {
      const b = new Uint8Array(len).map((_, i) => i * 7);
      expect(sha256Hex(b)).toBe(createHash('sha256').update(b).digest('hex').toUpperCase());
      expect(sha1Hex(b)).toBe(createHash('sha1').update(b).digest('hex').toUpperCase());
    }
  });
});

describe('ASN.1 outline', () => {
  it('describes a sequence', () => {
    const lines = asn1Outline(new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x05]));
    expect(lines[0]).toBe('SEQUENCE');
    expect(lines[1]).toContain('INTEGER 05');
  });
});
