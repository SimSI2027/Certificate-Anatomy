// Simplified ASN.1 outline of a byte range, for the advanced raw view.

import { decode, decodeOid, decodeString, decodeTime, toHex, TAG } from '../asn1/der.js';
import { oidName } from '../asn1/oids.js';

const UNIVERSAL = {
  [TAG.BOOLEAN]: 'BOOLEAN', [TAG.INTEGER]: 'INTEGER', [TAG.BIT_STRING]: 'BIT STRING', [TAG.OCTET_STRING]: 'OCTET STRING',
  [TAG.NULL]: 'NULL', [TAG.OID]: 'OBJECT IDENTIFIER', [TAG.UTF8_STRING]: 'UTF8String', [TAG.SEQUENCE]: 'SEQUENCE',
  [TAG.SET]: 'SET', [TAG.PRINTABLE_STRING]: 'PrintableString', [TAG.IA5_STRING]: 'IA5String', [TAG.UTC_TIME]: 'UTCTime',
  [TAG.GENERALIZED_TIME]: 'GeneralizedTime', [TAG.BMP_STRING]: 'BMPString',
};

function short(hex, n = 24) {
  return hex.length > n * 2 ? `${hex.slice(0, n * 2)}… (${hex.length / 2} bytes)` : hex;
}

function describe(node) {
  if (node.tagClass === 'context') return `[${node.tagNumber}]`;
  const name = UNIVERSAL[node.tagNumber] || `tag ${node.tagNumber}`;
  if (node.constructed) return name;
  const c = node.content;
  switch (node.tagNumber) {
    case TAG.OID: {
      const oid = decodeOid(c);
      const nm = oidName(oid);
      return `${name} ${oid}${nm !== oid ? ` (${nm})` : ''}`;
    }
    case TAG.INTEGER: return `${name} ${short(toHex(c))}`;
    case TAG.BOOLEAN: return `${name} ${c[0] ? 'TRUE' : 'FALSE'}`;
    case TAG.UTC_TIME:
    case TAG.GENERALIZED_TIME: return `${name} ${decodeTime(node).toISOString().replace('.000', '')}`;
    case TAG.UTF8_STRING:
    case TAG.PRINTABLE_STRING:
    case TAG.IA5_STRING:
    case TAG.BMP_STRING: return `${name} "${decodeString(node)}"`;
    case TAG.NULL: return name;
    default: return `${name} ${short(toHex(c))}`;
  }
}

/** Returns indented lines. Context-tagged primitives show their raw content. */
export function asn1Outline(bytes, maxLines = 80) {
  const lines = [];
  const walk = (node, depth) => {
    if (lines.length >= maxLines) return;
    let label = describe(node);
    if (node.tagClass === 'context' && !node.constructed) {
      const text = Array.from(node.content).every((b) => b >= 0x20 && b < 0x7f)
        ? `"${new TextDecoder().decode(node.content)}"` : short(toHex(node.content));
      label += ` ${text}`;
    }
    lines.push(`${'  '.repeat(depth)}${label}`);
    for (const child of node.children) walk(child, depth + 1);
  };
  try {
    walk(decode(bytes, 0), 0);
  } catch {
    lines.push('(not a complete DER element)');
  }
  if (lines.length >= maxLines) lines.push('…');
  return lines;
}
