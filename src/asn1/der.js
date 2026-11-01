// Minimal, dependency-free DER decoder.
// Shared by the browser application and the Node fixture/validation scripts.
// Every node keeps its exact byte range so the UI can connect structure to encoding.

export const TAG = Object.freeze({
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  SEQUENCE: 0x10,
  SET: 0x11,
  PRINTABLE_STRING: 0x13,
  IA5_STRING: 0x16,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  BMP_STRING: 0x1e,
});

const CLASS_NAMES = ['universal', 'application', 'context', 'private'];

/**
 * Decode one DER TLV (and, recursively, its children) at `offset`.
 * @param {Uint8Array} bytes
 * @param {number} [offset]
 * @returns {DerNode}
 */
export function decode(bytes, offset = 0) {
  const start = offset;
  if (offset >= bytes.length) throw new Error(`DER: unexpected end at ${offset}`);
  const first = bytes[offset++];
  const tagClass = CLASS_NAMES[first >> 6];
  const constructed = (first & 0x20) !== 0;
  let tagNumber = first & 0x1f;
  if (tagNumber === 0x1f) {
    tagNumber = 0;
    let b;
    do {
      b = bytes[offset++];
      tagNumber = (tagNumber << 7) | (b & 0x7f);
    } while (b & 0x80);
  }
  let length = bytes[offset++];
  if (length & 0x80) {
    const n = length & 0x7f;
    if (n === 0 || n > 4) throw new Error(`DER: unsupported length form at ${start}`);
    length = 0;
    for (let i = 0; i < n; i++) length = length * 256 + bytes[offset++];
  }
  const headerLength = offset - start;
  const end = offset + length;
  if (end > bytes.length) throw new Error(`DER: length overruns buffer at ${start}`);

  const node = {
    tagClass,
    tagNumber,
    constructed,
    offset: start,
    headerLength,
    length,
    end,
    children: [],
    /** Full TLV bytes. */
    get bytes() {
      return bytes.subarray(start, end);
    },
    /** Content bytes only (no tag/length header). */
    get content() {
      return bytes.subarray(start + headerLength, end);
    },
  };

  // Constructed types, plus context-tagged wrappers, hold nested TLVs.
  if (constructed) {
    let p = offset;
    while (p < end) {
      const child = decode(bytes, p);
      node.children.push(child);
      p = child.end;
    }
  }
  return node;
}

/** Decode and require that the whole buffer is exactly one TLV. */
export function decodeStrict(bytes) {
  const root = decode(bytes, 0);
  if (root.end !== bytes.length) throw new Error('DER: trailing bytes after root element');
  return root;
}

export function isUniversal(node, tagNumber) {
  return node.tagClass === 'universal' && node.tagNumber === tagNumber;
}

export function isContext(node, tagNumber) {
  return node.tagClass === 'context' && node.tagNumber === tagNumber;
}

export function decodeOid(content) {
  const parts = [];
  let value = 0;
  for (let i = 0; i < content.length; i++) {
    value = value * 128 + (content[i] & 0x7f);
    if (!(content[i] & 0x80)) {
      if (parts.length === 0) {
        const first = value < 40 ? 0 : value < 80 ? 1 : 2;
        parts.push(first, value - first * 40);
      } else {
        parts.push(value);
      }
      value = 0;
    }
  }
  return parts.join('.');
}

export function decodeString(node) {
  const c = node.content;
  if (node.tagNumber === TAG.BMP_STRING) {
    let s = '';
    for (let i = 0; i + 1 < c.length; i += 2) s += String.fromCharCode((c[i] << 8) | c[i + 1]);
    return s;
  }
  return new TextDecoder('utf-8').decode(c);
}

export function decodeTime(node) {
  const s = new TextDecoder('ascii').decode(node.content);
  let year, rest;
  if (node.tagNumber === TAG.UTC_TIME) {
    const yy = Number(s.slice(0, 2));
    year = yy >= 50 ? 1900 + yy : 2000 + yy;
    rest = s.slice(2);
  } else {
    year = Number(s.slice(0, 4));
    rest = s.slice(4);
  }
  const [mo, d, h, mi, se] = [0, 2, 4, 6, 8].map((i) => Number(rest.slice(i, i + 2)));
  return new Date(Date.UTC(year, mo - 1, d, h, mi, se || 0));
}

export function decodeInteger(node) {
  return toHex(node.content);
}

export function decodeBoolean(node) {
  return node.content[0] !== 0;
}

export function toHex(bytes, sep = '') {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += (i && sep ? sep : '') + bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return out;
}

/** Bit string content: first byte is the unused-bit count. */
export function bitStringBytes(node) {
  return node.content.subarray(1);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromBase64(text) {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

/** Extract the bytes of the first PEM block with the given label. */
export function pemToDer(pem, label) {
  const re = label
    ? new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`)
    : /-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/;
  const m = pem.match(re);
  if (!m) throw new Error(`PEM block ${label || ''} not found`);
  return fromBase64(m[1]);
}

/** Split all PEM blocks out of a bundle (e.g. a chain file). */
export function pemBlocks(pem) {
  const out = [];
  const re = /-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/g;
  let m;
  while ((m = re.exec(pem))) out.push({ label: m[1], der: fromBase64(m[2]) });
  return out;
}

export function derToPem(der, label) {
  const b64 = toBase64(der);
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}
