// Turns DER bytes into the anatomy trees the learner explores.
// Every node carries its exact byte range and a value read from the artifact.

import {
  decodeStrict, decodeOid, decodeString, decodeTime, decodeInteger, decodeBoolean,
  isContext, isUniversal, toHex, bitStringBytes, TAG,
} from '../asn1/der.js';
import { OID, KEY_USAGE_BITS, oidName } from '../asn1/oids.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n) => String(n).padStart(2, '0');
/** Locale-independent UTC display, identical on every machine. */
export const formatUtc = (d) =>
  `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} UTC`;

const node = (id, label, der, extra = {}) => ({
  id,
  label,
  range: der ? [der.offset, der.end] : null,
  children: [],
  ...extra,
});

export function parseName(der) {
  const parts = [];
  for (const rdn of der.children) {
    for (const atv of rdn.children) {
      const [type, value] = atv.children;
      parts.push({ type: oidName(decodeOid(type.content)), value: decodeString(value) });
    }
  }
  return parts;
}

/** Display order matches Windows and most viewers: most specific (CN) first. */
export const formatName = (parts) => [...parts].reverse().map((p) => `${p.type}=${p.value}`).join(', ');

function parseAlgorithm(der) {
  const id = decodeOid(der.children[0].content);
  return { oid: id, name: oidName(id), hasNullParams: der.children[1] ? isUniversal(der.children[1], TAG.NULL) : false };
}

function parseSpki(der, prefix) {
  const alg = parseAlgorithm(der.children[0]);
  const keyBits = bitStringBytes(der.children[1]);
  const rsa = decodeStrict(keyBits);
  const modulus = rsa.children[0].content;
  const exponent = parseInt(toHex(rsa.children[1].content), 16);
  const mod = modulus[0] === 0 ? modulus.subarray(1) : modulus;
  const bits = mod.length * 8 - Math.clz32(mod[0]) + 24;
  const n = node(`${prefix}.spki`, 'Subject Public Key Info', der, {
    asn1: 'SubjectPublicKeyInfo',
    value: `${alg.name === 'rsaEncryption' ? 'RSA' : alg.name} ${bits}-bit public key`,
    data: { algorithm: alg, bits, exponent, modulusHex: toHex(mod), spkiBytes: der.bytes },
  });
  n.children.push(
    node(`${prefix}.spki.algorithm`, 'Public Key Algorithm', der.children[0], {
      asn1: 'AlgorithmIdentifier',
      value: `${alg.name} (${alg.oid})`,
    }),
    node(`${prefix}.spki.publicKey`, 'Public Key', der.children[1], {
      asn1: 'BIT STRING (RSAPublicKey)',
      value: `Modulus ${bits} bits, exponent ${exponent}`,
      data: { modulusHex: toHex(mod), exponent, bits },
    }),
  );
  return n;
}

function parseGeneralNames(seqDer) {
  return seqDer.children.map((gn) => {
    if (isContext(gn, 2)) return { type: 'DNS', value: new TextDecoder().decode(gn.content) };
    if (isContext(gn, 6)) return { type: 'URI', value: new TextDecoder().decode(gn.content) };
    return { type: `[${gn.tagNumber}]`, value: toHex(gn.content) };
  });
}

const EXT_IDS = {
  [OID.subjectAltName]: 'san',
  [OID.keyUsage]: 'ku',
  [OID.extKeyUsage]: 'eku',
  [OID.basicConstraints]: 'bc',
  [OID.subjectKeyIdentifier]: 'ski',
  [OID.authorityKeyIdentifier]: 'aki',
  [OID.authorityInfoAccess]: 'aia',
  [OID.cRLDistributionPoints]: 'cdp',
};

/** Decode one Extension into a display value plus structured data. */
export function parseExtension(der) {
  const kids = der.children;
  const extOid = decodeOid(kids[0].content);
  const critical = kids.length === 3 ? decodeBoolean(kids[1]) : false;
  const inner = decodeStrict(kids[kids.length - 1].content);
  let value = '';
  let data = {};
  switch (extOid) {
    case OID.subjectAltName: {
      const names = parseGeneralNames(inner);
      data = { names };
      value = names.map((n) => `${n.type}: ${n.value}`).join('\n');
      break;
    }
    case OID.keyUsage: {
      const c = inner.content;
      const usages = [];
      for (let i = 0; i < KEY_USAGE_BITS.length; i++) {
        const byte = c[1 + Math.floor(i / 8)];
        if (byte !== undefined && byte & (0x80 >> i % 8)) usages.push(KEY_USAGE_BITS[i]);
      }
      data = { usages };
      value = usages.join(', ');
      break;
    }
    case OID.extKeyUsage: {
      const purposes = inner.children.map((o) => decodeOid(o.content));
      data = { purposes };
      value = purposes.map((p) => `${oidName(p)} (${p})`).join(', ');
      break;
    }
    case OID.basicConstraints: {
      const isCa = inner.children[0] ? decodeBoolean(inner.children[0]) : false;
      const pathLen = inner.children[1] ? parseInt(toHex(inner.children[1].content), 16) : null;
      data = { isCa, pathLen };
      value = isCa ? `Subject Type=CA${pathLen !== null ? `, Path Length=${pathLen}` : ''}` : 'Subject Type=End Entity (cA = FALSE)';
      break;
    }
    case OID.subjectKeyIdentifier: {
      data = { keyId: toHex(inner.content) };
      value = toHex(inner.content, ' ');
      break;
    }
    case OID.authorityKeyIdentifier: {
      const kid = inner.children.find((c) => isContext(c, 0));
      data = { keyId: kid ? toHex(kid.content) : null };
      value = kid ? `KeyID=${toHex(kid.content, ' ')}` : '';
      break;
    }
    case OID.authorityInfoAccess: {
      const entries = inner.children.map((ad) => ({
        method: oidName(decodeOid(ad.children[0].content)),
        location: new TextDecoder().decode(ad.children[1].content),
      }));
      data = { entries };
      value = entries.map((e) => `${e.method}: ${e.location}`).join('\n');
      break;
    }
    case OID.cRLDistributionPoints: {
      const urls = [];
      for (const dp of inner.children) {
        const dpName = dp.children.find((c) => isContext(c, 0));
        const full = dpName && dpName.children.find((c) => isContext(c, 0));
        if (full) for (const gn of full.children) if (isContext(gn, 6)) urls.push(new TextDecoder().decode(gn.content));
      }
      data = { urls };
      value = urls.join('\n');
      break;
    }
    default:
      value = toHex(inner.content, ' ');
  }
  return { oid: extOid, key: EXT_IDS[extOid] || extOid, name: oidName(extOid), critical, value, data };
}

function signatureNodes(prefix, algDer, sigDer, labels) {
  const alg = parseAlgorithm(algDer);
  const sig = bitStringBytes(sigDer);
  return [
    node(`${prefix}.sigAlg`, labels.alg, algDer, {
      asn1: 'AlgorithmIdentifier',
      value: `${alg.name} (${alg.oid})`,
      data: alg,
    }),
    node(`${prefix}.sigValue`, labels.value, sigDer, {
      asn1: 'BIT STRING',
      value: `${sig.length * 8}-bit RSA signature`,
      data: { hex: toHex(sig), bytes: sig.length },
    }),
  ];
}

/** X.509 certificate anatomy. */
export function buildCertificateModel(der) {
  const root = decodeStrict(der);
  const [tbs, sigAlgDer, sigDer] = root.children;
  const k = tbs.children;
  let i = 0;
  const versionDer = isContext(k[0], 0) ? k[i++] : null;
  const serialDer = k[i++];
  const tbsSigDer = k[i++];
  const issuerDer = k[i++];
  const validityDer = k[i++];
  const subjectDer = k[i++];
  const spkiDer = k[i++];
  const extsWrapper = k.slice(i).find((c) => isContext(c, 3));

  const issuer = parseName(issuerDer);
  const subject = parseName(subjectDer);
  const notBefore = decodeTime(validityDer.children[0]);
  const notAfter = decodeTime(validityDer.children[1]);
  const version = versionDer ? parseInt(toHex(versionDer.children[0].content), 16) + 1 : 1;
  const tbsAlg = parseAlgorithm(tbsSigDer);

  const certNode = node('cert', 'Certificate', root, { asn1: 'Certificate', value: `${der.length} bytes, DER` });
  const tbsNode = node('cert.tbs', 'TBSCertificate', tbs, {
    asn1: 'TBSCertificate',
    value: 'The signed body: identity, key, policy result and trust pointers',
  });
  const validityNode = node('cert.tbs.validity', 'Validity', validityDer, {
    asn1: 'Validity',
    value: `${formatUtc(notBefore)} to ${formatUtc(notAfter)}`,
    data: { notBefore, notAfter },
  });
  validityNode.children.push(
    node('cert.tbs.validity.notBefore', 'Not Before', validityDer.children[0], {
      asn1: validityDer.children[0].tagNumber === TAG.UTC_TIME ? 'UTCTime' : 'GeneralizedTime',
      value: formatUtc(notBefore),
    }),
    node('cert.tbs.validity.notAfter', 'Not After', validityDer.children[1], {
      asn1: validityDer.children[1].tagNumber === TAG.UTC_TIME ? 'UTCTime' : 'GeneralizedTime',
      value: formatUtc(notAfter),
    }),
  );

  const extensions = [];
  const extNode = node('cert.tbs.extensions', 'Extensions', extsWrapper, {
    asn1: '[3] Extensions',
    value: '',
  });
  if (extsWrapper) {
    for (const e of extsWrapper.children[0].children) {
      const parsed = parseExtension(e);
      extensions.push(parsed);
      extNode.children.push(
        node(`cert.ext.${parsed.key}`, parsed.name, e, {
          asn1: `Extension ${parsed.oid}`,
          value: parsed.value,
          critical: parsed.critical,
          data: parsed.data,
        }),
      );
    }
  }
  extNode.value = `${extensions.length} extensions`;

  tbsNode.children.push(
    node('cert.tbs.version', 'Version', versionDer, { asn1: '[0] INTEGER', value: `V${version} (encoded ${version - 1})` }),
    node('cert.tbs.serial', 'Serial Number', serialDer, {
      asn1: 'INTEGER',
      value: toHex(serialDer.content.subarray(serialDer.content[0] === 0 ? 1 : 0), ' '),
      data: { hex: decodeInteger(serialDer) },
    }),
    node('cert.tbs.signature', 'Signature Algorithm', tbsSigDer, {
      asn1: 'AlgorithmIdentifier',
      value: `${tbsAlg.name} (${tbsAlg.oid})`,
    }),
    node('cert.tbs.issuer', 'Issuer', issuerDer, { asn1: 'Name', value: formatName(issuer), data: { parts: issuer } }),
    validityNode,
    node('cert.tbs.subject', 'Subject', subjectDer, { asn1: 'Name', value: formatName(subject), data: { parts: subject } }),
    parseSpki(spkiDer, 'cert.tbs'),
    extNode,
  );

  certNode.children.push(
    tbsNode,
    ...signatureNodes('cert', sigAlgDer, sigDer, {
      alg: 'Certificate Signature Algorithm',
      value: 'Certificate Signature Value',
    }),
  );

  return {
    kind: 'certificate',
    der,
    tree: certNode,
    tbsBytes: tbs.bytes,
    signatureBytes: bitStringBytes(sigDer),
    version,
    serialHex: decodeInteger(serialDer).replace(/^00/, ''),
    issuer,
    subject,
    notBefore,
    notAfter,
    spkiBytes: spkiDer.bytes,
    extensions,
    ext: Object.fromEntries(extensions.map((e) => [e.key, e])),
  };
}

/** PKCS #10 CertificationRequest anatomy. */
export function buildCsrModel(der) {
  const root = decodeStrict(der);
  const [cri, sigAlgDer, sigDer] = root.children;
  const [versionDer, subjectDer, spkiDer, attrsDer] = cri.children;
  const subject = parseName(subjectDer);
  const version = parseInt(toHex(versionDer.content), 16);

  const csrNode = node('csr', 'CertificationRequest', root, { asn1: 'CertificationRequest', value: `${der.length} bytes, DER` });
  const criNode = node('csr.cri', 'CertificationRequestInfo', cri, {
    asn1: 'CertificationRequestInfo',
    value: 'The signed body: requested identity, public key and requested extensions',
  });
  const attrsNode = node('csr.cri.attributes', 'Attributes', attrsDer, { asn1: '[0] Attributes', value: '' });

  const extensions = [];
  const attributes = [];
  for (const attr of attrsDer ? attrsDer.children : []) {
    const attrOid = decodeOid(attr.children[0].content);
    const values = attr.children[1];
    if (attrOid === OID.extensionRequest) {
      const extReqNode = node('csr.attr.extReq', 'Extension Request', attr, {
        asn1: `Attribute ${attrOid}`,
        value: '',
      });
      for (const e of values.children[0].children) {
        const parsed = parseExtension(e);
        extensions.push(parsed);
        extReqNode.children.push(
          node(`csr.ext.${parsed.key}`, `Requested ${parsed.name}`, e, {
            asn1: `Extension ${parsed.oid}`,
            value: parsed.value,
            critical: parsed.critical,
            data: parsed.data,
          }),
        );
      }
      extReqNode.value = `${extReqNode.children.length} requested extensions`;
      attributes.push({ oid: attrOid, name: 'Extension Request' });
      attrsNode.children.push(extReqNode);
    } else if (attrOid === OID.enrollmentNameValuePair) {
      const pair = values.children[0].children.map(decodeString);
      attributes.push({ oid: attrOid, name: 'Enrollment Name-Value Pair', pair });
      attrsNode.children.push(
        node('csr.attr.template', 'Template Request Attribute', attr, {
          asn1: `Attribute ${attrOid}`,
          value: `${pair[0]}: ${pair[1]}`,
          data: { name: pair[0], value: pair[1] },
        }),
      );
    } else {
      attributes.push({ oid: attrOid, name: oidName(attrOid) });
    }
  }
  attrsNode.value = `${attrsNode.children.length} attributes`;

  criNode.children.push(
    node('csr.cri.version', 'Version', versionDer, { asn1: 'INTEGER', value: `v1 (encoded ${version})` }),
    node('csr.cri.subject', 'Subject', subjectDer, { asn1: 'Name', value: formatName(subject), data: { parts: subject } }),
    parseSpki(spkiDer, 'csr.cri'),
    attrsNode,
  );
  csrNode.children.push(
    criNode,
    ...signatureNodes('csr', sigAlgDer, sigDer, { alg: 'Signature Algorithm', value: 'Signature Value' }),
  );

  return {
    kind: 'pkcs10',
    der,
    tree: csrNode,
    criBytes: cri.bytes,
    signatureBytes: bitStringBytes(sigDer),
    version,
    subject,
    spkiBytes: spkiDer.bytes,
    attributes,
    extensions,
    ext: Object.fromEntries(extensions.map((e) => [e.key, e])),
  };
}

/** Flatten a tree into id -> node. */
export function indexTree(tree, map = new Map(), parent = null) {
  map.set(tree.id, { ...tree, parentId: parent });
  for (const c of tree.children) indexTree(c, map, tree.id);
  return map;
}

export function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
