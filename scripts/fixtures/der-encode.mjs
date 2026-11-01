// Minimal DER encoder used only by the fixture generator.

function lengthBytes(n) {
  if (n < 0x80) return Buffer.from([n]);
  const out = [];
  while (n > 0) {
    out.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  return Buffer.from([0x80 | out.length, ...out]);
}

export function tlv(tag, content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return Buffer.concat([Buffer.from([tag]), lengthBytes(body.length), body]);
}

export const seq = (...items) => tlv(0x30, Buffer.concat(items));

/** DER SET OF: elements sorted by their encodings (X.690 11.6). */
export function setOf(...items) {
  const sorted = [...items].sort((a, b) => {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = i < a.length ? a[i] : 0;
      const y = i < b.length ? b[i] : 0;
      if (x !== y) return x - y;
    }
    return 0;
  });
  return tlv(0x31, Buffer.concat(sorted));
}

/** Context-specific constructed (EXPLICIT or constructed IMPLICIT) tag. */
export const ctxCons = (n, ...items) => tlv(0xa0 | n, Buffer.concat(items));
/** Context-specific primitive (IMPLICIT) tag. */
export const ctxPrim = (n, content) => tlv(0x80 | n, content);

export function integer(value) {
  let hex = typeof value === 'bigint' ? value.toString(16) : Number(value).toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let buf = Buffer.from(hex, 'hex');
  if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]);
  return tlv(0x02, buf);
}

/** Integer from a raw positive hex string (e.g. a serial number). */
export function integerHex(hex) {
  let buf = Buffer.from(hex, 'hex');
  while (buf.length > 1 && buf[0] === 0 && !(buf[1] & 0x80)) buf = buf.subarray(1);
  if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]);
  return tlv(0x02, buf);
}

export function oid(dotted) {
  const parts = dotted.split('.').map(Number);
  const bytes = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    const chunk = [];
    let v = p;
    chunk.unshift(v & 0x7f);
    v = Math.floor(v / 128);
    while (v > 0) {
      chunk.unshift(0x80 | (v & 0x7f));
      v = Math.floor(v / 128);
    }
    bytes.push(...chunk);
  }
  return tlv(0x06, Buffer.from(bytes));
}

export const nullValue = () => Buffer.from([0x05, 0x00]);
export const bool = (v) => tlv(0x01, Buffer.from([v ? 0xff : 0x00]));
export const octets = (b) => tlv(0x04, b);
export const utf8 = (s) => tlv(0x0c, Buffer.from(s, 'utf8'));
export const printable = (s) => tlv(0x13, Buffer.from(s, 'ascii'));
export const ia5 = (s) => tlv(0x16, Buffer.from(s, 'ascii'));

export function bmp(s) {
  const b = Buffer.alloc(s.length * 2);
  for (let i = 0; i < s.length; i++) b.writeUInt16BE(s.charCodeAt(i), i * 2);
  return tlv(0x1e, b);
}

export function bitString(bytes, unusedBits = 0) {
  return tlv(0x03, Buffer.concat([Buffer.from([unusedBits]), bytes]));
}

/** Named-bit BIT STRING with trailing zero bits removed (DER rule for KeyUsage). */
export function namedBits(bitIndexes) {
  const max = Math.max(...bitIndexes);
  const byteLen = Math.floor(max / 8) + 1;
  const buf = Buffer.alloc(byteLen);
  for (const i of bitIndexes) buf[Math.floor(i / 8)] |= 0x80 >> i % 8;
  const unused = 7 - (max % 8);
  return bitString(buf, unused);
}

function two(n) {
  return String(n).padStart(2, '0');
}

/** UTCTime for years 1950-2049, GeneralizedTime otherwise (RFC 5280 4.1.2.5). */
export function time(date) {
  const y = date.getUTCFullYear();
  const rest =
    two(date.getUTCMonth() + 1) +
    two(date.getUTCDate()) +
    two(date.getUTCHours()) +
    two(date.getUTCMinutes()) +
    two(date.getUTCSeconds()) +
    'Z';
  if (y >= 1950 && y < 2050) return tlv(0x17, Buffer.from(two(y % 100) + rest, 'ascii'));
  return tlv(0x18, Buffer.from(String(y) + rest, 'ascii'));
}
