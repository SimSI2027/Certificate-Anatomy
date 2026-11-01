// Builds the DOM for each stage element. Content is created once per element;
// the motion loop only changes geometry and a few CSS variables afterwards.

import { h, formatDate, groupHex } from './dom.js';
import { toHex, toBase64 } from '../asn1/der.js';
import { CATEGORIES } from '../anatomy/categories.js';
import { RELATIONSHIPS } from '../anatomy/relationships.js';
import { SCENARIO } from '../scenario/scenario.js';
import { FLOW_STAGES, EVALUATION_CHECKS, VERIFICATION_CHECKS, LEARNING_NOTE, ACTORS } from '../scenario/issuance.js';
import { FLOW_TOKENS } from '../motion/layout.js';

export function elementType(id) {
  if (id === 'cert' || id === 'csr') return 'block';
  if (id === 'csr.privateKey' || id === 'flow.key') return 'keymat';
  if (id.startsWith('rel.') || id.startsWith('link.') || id === 'flow.pair') return 'path';
  if (id.startsWith('enc.')) return 'encoding';
  if (id.startsWith('cmp.head.')) return 'heading';
  if (id.startsWith('flow.')) return 'flow';
  return 'plate';
}

export const isInteractive = (id) => ['block', 'keymat', 'plate'].includes(elementType(id)) && id !== 'flow.key';

const cn = (parts) => parts.find((p) => p.type === 'CN')?.value || '';

function categoryVar(cat) {
  return cat ? `var(--cat-${cat})` : 'transparent';
}

// ---------------------------------------------------------------------------

function plate(id, ctx) {
  const node = ctx.node(id);
  const def = ctx.definition(id);
  const artifact = id.startsWith('csr') ? 'csr' : 'cert';
  const cat = artifact === 'cert' ? def?.category : 'requested';
  const kids = node.children || [];
  const bytes = node.range ? ctx.bytes[artifact].subarray(node.range[0], node.range[1]) : null;
  const role = id.endsWith('sigValue') || id.endsWith('sigAlg') ? 'sig' : 'field';
  const valueLine = String(node.value || '').split('\n').join('  ·  ');
  const meta = node.range
    ? `${node.asn1 || ''}${node.asn1 ? ', ' : ''}${node.range[1] - node.range[0]} bytes at offset ${node.range[0]}`
    : node.asn1 || '';
  const label = def?.title || node.label;

  return h('button', {
    class: 'el plate',
    type: 'button',
    'data-node': id,
    'data-artifact': artifact,
    'data-role': role,
    'data-computed': def?.computed ? 'true' : null,
    'aria-label': `${label}. ${valueLine}${kids.length ? `. Contains ${kids.length} parts` : ''}`,
    style: { '--cat': categoryVar(cat) },
  },
  h('span', { class: 'pv-stripe' }),
  h('span', { class: 'plate-body' },
    h('span', { class: 'plate-head' },
      h('span', { class: 'plate-label', text: label }),
      cat ? h('span', { class: 'plate-tag', text: CATEGORIES[cat].short }) : null,
      kids.length ? h('span', { class: 'plate-chevron', 'aria-hidden': 'true' }) : null,
    ),
    h('span', { class: 'plate-value', translate: 'no', text: valueLine }),
    kids.length ? h('span', { class: 'plate-opened', 'aria-hidden': 'true', text: `${kids.length} parts opened in the next column` }) : null,
    h('span', { class: 'plate-meta', text: meta }),
    kids.length > 3
      ? h('span', { class: 'plate-preview', 'aria-hidden': 'true' }, kids.map((k) => h('span', { text: k.label })))
      : null,
    bytes ? h('span', { class: 'plate-hex', 'aria-hidden': 'true', text: groupHex(toHex(bytes.subarray(0, 96))) }) : null,
  ),
  h('span', { class: 'spine-label', 'aria-hidden': 'true', text: label }),
  h('span', { class: 'edge-band' }),
  );
}

function block(id, ctx) {
  const isCert = id === 'cert';
  const m = isCert ? ctx.models.cert : ctx.models.csr;
  const der = ctx.bytes[id];
  const texture = toBase64(der).slice(0, 1400);
  const sigHex = groupHex(toHex(m.signatureBytes.subarray(0, 48)));
  const sanNames = (m.ext.san?.data.names || []).map((n) => n.value).join(', ');
  const purposes = (m.ext.eku?.data.purposes || []).map((p) => (p === '1.3.6.1.5.5.7.3.1' ? 'Server Authentication' : p)).join(', ');
  let rows;
  if (isCert) {
    const clock = new Date(SCENARIO.dates.simulationClock);
    const current = m.notBefore <= clock && clock <= m.notAfter;
    rows = [
      ['Issued by', cn(m.issuer)],
      ['Valid', `${formatDate(m.notBefore)} to ${formatDate(m.notAfter)}${current ? ', current' : ''}`],
      ['DNS names', sanNames],
      ['Purpose', purposes],
      ['Path', `${cn(ctx.models.root.subject)} › ${cn(ctx.models.issuing.subject)} › ${cn(m.subject)}`],
    ];
  } else {
    rows = [
      ['Created on', SCENARIO.requestingMachine],
      ['Public key', `RSA ${ctx.models.csr.tree.children[0].children[2].data.bits}, SHA-256 ${ctx.fingerprints.csrSpkiSha256.slice(0, 16)}…`],
      ['Requests', sanNames],
      ['Purpose', `${purposes} (requested)`],
      ['Template', m.attributes.find((a) => a.pair)?.pair[1] || ''],
    ];
  }
  const label = isCert
    ? `Signed certificate for ${cn(m.subject)}. Select to take it apart.`
    : `Certificate signing request for ${cn(m.subject)}. Select to take it apart.`;

  return h('button', { class: 'el block', type: 'button', 'data-node': id, 'data-artifact': id, 'aria-label': label },
    h('span', { class: 'block-face' },
      h('span', { class: 'block-texture', 'aria-hidden': 'true', text: texture }),
      h('span', { class: 'block-kind', text: isCert ? `Signed certificate, X.509 v3, ${der.length} bytes` : `Certificate signing request, PKCS #10, ${der.length} bytes` }),
      h('span', { class: 'block-title', translate: 'no', text: cn(m.subject) }),
      h('dl', { class: 'block-rows' }, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])),
      h('span', { class: 'block-seal' },
        h('span', { text: isCert ? `Signed by ${cn(m.issuer)}` : 'Signed with APP01\'s private key' }),
        h('span', { class: 'seal-bytes', 'aria-hidden': 'true', text: sigHex }),
      ),
    ),
    h('span', { class: 'block-header' },
      h('span', { class: 'bh-name', text: isCert ? 'Certificate' : 'CertificationRequest' }),
      h('span', { class: 'bh-meta', text: `SEQUENCE, ${der.length} bytes` }),
      h('span', { class: 'bh-action', text: 'Reassemble' }),
    ),
  );
}

function keymat(id) {
  const compact = id === 'flow.key';
  const tag = compact ? 'div' : 'button';
  return h(tag, {
    class: 'el keymat', type: compact ? null : 'button', 'data-node': id, 'data-compact': compact ? 'true' : null,
    'aria-label': compact ? null : 'APP01 private key. Stays on APP01. Not part of the CSR.',
  },
  h('span', { class: 'keymat-body' },
    h('span', { class: 'keymat-title', text: 'APP01 private key' }),
    h('span', { class: 'keymat-sub', text: 'RSA 2048, Local Computer key store, non-exportable' }),
    h('span', { class: 'keymat-sub', text: compact ? 'Never leaves APP01' : 'Not part of the CSR. Never sent anywhere.' }),
    h('span', { class: 'keymat-mask', 'aria-hidden': 'true', text: '•••• •••• •••• •••• •••• •••• •••• •••• •••• ••••' }),
  ));
}

function encodingPanel(id, ctx) {
  const [, kind, mode] = id.split('.');
  const der = ctx.bytes[kind];
  const tree = ctx.trees[kind];
  const [body, alg, sig] = tree.children;
  const segOf = (b) =>
    b < body.range[0] ? 'hdr' : b < body.range[1] ? 'body' : b < alg.range[1] ? 'alg' : 'sig';
  const runs = [];
  const push = (cls, text) => {
    const last = runs[runs.length - 1];
    if (last && last.cls === cls) last.text += text;
    else runs.push({ cls, text });
  };
  const label = kind === 'cert' ? 'CERTIFICATE' : 'CERTIFICATE REQUEST';
  if (mode === 'hex') {
    for (let i = 0; i < der.length; i++) push(segOf(i), der[i].toString(16).padStart(2, '0').toUpperCase() + ' ');
  } else {
    const b64 = toBase64(der);
    if (mode === 'pem') push('armor', `-----BEGIN ${label}-----\n`);
    for (let i = 0; i < b64.length; i++) {
      push(segOf(Math.min(der.length - 1, Math.floor((i * 6) / 8))), b64[i]);
      if (mode === 'pem' && (i + 1) % 64 === 0 && i + 1 < b64.length) push(segOf(Math.floor(((i + 1) * 6) / 8)), '\n');
    }
    if (mode === 'pem') push('armor', `\n-----END ${label}-----`);
  }
  const titles = {
    hex: ['DER bytes', `The exact ${der.length} bytes, shown as hexadecimal. Each structure from the exploded view is one coloured run.`],
    base64: ['Base64', 'The same bytes, three at a time, written as four printable characters so they survive email and copy-paste.'],
    pem: ['PEM', 'Base64 wrapped at 64 characters between BEGIN and END lines. This is the “block of letters” people paste into a CA.'],
  };
  const names = kind === 'cert'
    ? ['TBSCertificate', 'Signature algorithm', 'CA signature value']
    : ['CertificationRequestInfo', 'Signature algorithm', 'APP01 signature value'];
  const range = (n) => `bytes ${n.range[0]} to ${n.range[1] - 1}`;
  return h('div', { class: 'el encoding', 'data-node': id, 'data-artifact': kind, role: 'region', 'aria-label': `${titles[mode][0]} encoding` },
    h('h2', { text: `${kind === 'cert' ? 'Certificate' : 'CSR'} as ${titles[mode][0]}` }),
    h('p', { text: titles[mode][1] }),
    h('ul', { class: 'enc-legend' },
      h('li', {}, h('i', { style: { background: 'var(--ink-3)' } }), 'Outer SEQUENCE header'),
      h('li', {}, h('i', { style: { background: kind === 'cert' ? 'var(--cert)' : 'var(--csr)' } }), `${names[0]}, ${range(body)}`),
      h('li', {}, h('i', { style: { background: 'var(--ca)' } }), `${names[1]}, ${range(alg)}`),
      h('li', {}, h('i', { style: { background: '#d9a59f' } }), `${names[2]}, ${range(sig)}`),
    ),
    h('div', { class: 'enc-bytes', tabindex: '0', 'aria-label': `${titles[mode][0]} text` },
      runs.map((r) => h('span', { class: r.cls === 'armor' ? 'pem-armor' : `seg-${r.cls}`, text: r.text }))),
  );
}

function heading(id) {
  const csr = id.endsWith('csr');
  return h('div', { class: 'el heading', 'data-node': id },
    h('strong', { text: csr ? 'CSR' : 'Issued certificate' }),
    h('span', { text: csr ? 'What APP01 asked for, signed by APP01' : 'What the Issuing CA decided, signed by the CA' }),
  );
}

// ---------------------------------------------------------------------------
// Flow

function flow(id, ctx) {
  const m = ctx.models.cert;
  const card = (variant, ...children) => h('div', { class: `el flowcard${variant === 'muted' ? ' muted' : ''}`, 'data-node': id, 'data-variant': variant }, ...children);
  const checklist = (items) => h('ul', { class: 'checklist' },
    items.map((c, i) => h('li', { style: { '--i': i } }, h('b', { text: c.label }), h('span', { text: c.detail }))));

  if (id.startsWith('flow.zone.')) {
    const z = id.split('.')[2];
    const a = z === 'app' ? ACTORS.app : z === 'lane' ? ACTORS.administrator : ACTORS.ca;
    const role = z === 'app' ? 'Requesting machine. Owns the private key.'
      : z === 'lane' ? 'Administrator. Runs the commands, carries files.'
        : `${a.host}. Evaluates and signs.`;
    return h('div', { class: 'el zone', 'data-node': id, 'data-zone': z },
      h('div', { class: 'zone-name', text: a.name }), h('div', { class: 'zone-role', text: role }));
  }
  if (id.startsWith('flow.tok.')) {
    const t = FLOW_TOKENS.find((x) => `flow.tok.${x.id}` === id);
    const src = t.from === 'csr' ? 'from CSR, approved' : t.category === 'config' ? 'CA configuration' : t.category === 'derived' ? 'derived' : 'CA';
    return h('div', { class: 'el token', 'data-node': id, style: { '--cat': `var(--cat-${t.category})` } },
      h('span', { text: t.label }), h('small', { text: src }));
  }
  if (id.startsWith('flow.cmd.')) {
    const st = FLOW_STAGES.find((s) => `flow.cmd.${s.id}` === id);
    return h('div', { class: 'el command', 'data-node': id },
      h('span', { class: 'cmd-host', text: `On ${st.command.host}` }),
      h('code', { translate: 'no', text: st.command.text }),
      h('span', { class: 'cmd-note', text: LEARNING_NOTE }));
  }
  switch (id) {
    case 'flow.root':
      return card('muted', h('h3', { text: `${SCENARIO.rootCa}, offline` }),
        h('div', { text: 'Signed the Issuing CA certificate in Jan 2026. Not used now.' }));
    case 'flow.pending':
      return card('', h('div', { class: 'storepath' }, SCENARIO.pendingStore.slice(0, 2).map((s) => h('span', { text: s }))),
        h('div', { text: 'Pending request, linked to the new private key' }));
    case 'flow.reqrec':
      return card('ca', h('h3', { text: `CA database, request ${SCENARIO.requestId}` }),
        h('div', { text: `Requester: ${SCENARIO.administrator}` }),
        h('div', { class: 'disp' },
          h('span', { text: 'Disposition: received, pending evaluation' }),
          h('span', { text: 'Disposition: under evaluation' }),
          h('span', { text: `Disposition: issued, serial ${groupHex(m.serialHex).slice(0, 23)}…` })));
    case 'flow.cakey':
      return card('cakey', h('h3', { text: 'Issuing CA private key' }),
        h('div', { text: 'Signs certificates and CRLs. Never leaves ICA01.' }));
    case 'flow.eval':
      return card('', h('h3', { text: `Evaluating request ${SCENARIO.requestId}` }), checklist(EVALUATION_CHECKS));
    case 'flow.verify':
      return card('', h('h3', { text: 'Verification on APP01' }), checklist(VERIFICATION_CHECKS));
    case 'flow.newcert':
      return h('div', { class: 'el newcert', 'data-node': id },
        h('h3', { text: 'New certificate, built by the CA' }),
        h('p', { text: 'A separate structure. The CSR is not changed or signed.' }));
    case 'flow.seal':
      return h('div', { class: 'el seal', 'data-node': id },
        h('span', { text: 'Signed with the Issuing CA private key' }),
        h('span', { class: 'seal-bytes', 'aria-hidden': 'true', text: groupHex(toHex(m.signatureBytes.subarray(0, 16))) }));
    case 'flow.store':
      return card('', h('div', { class: 'storepath' }, SCENARIO.store.map((s) => h('span', { text: s }))));
    case 'flow.match':
      return card('', h('div', { class: 'match' },
        h('h3', { text: 'Public keys compared' }),
        h('div', { text: 'CSR public key, SHA-256' }),
        h('div', { class: 'fp', text: groupHex(ctx.fingerprints.csrSpkiSha256.slice(0, 32)) + '…' }),
        h('div', { text: 'Certificate public key, SHA-256' }),
        h('div', { class: 'fp', text: groupHex(ctx.fingerprints.certSpkiSha256.slice(0, 32)) + '…' }),
        h('div', { class: 'eq', text: ctx.fingerprints.spkiMatch ? 'Identical. The certificate is linked to the existing private key.' : 'Different' })));
    case 'flow.carry':
      return h('div', { class: 'el carry', 'data-node': id }, h('b', { text: 'CSR file' }), 'Public request data only');
    case 'flow.carry.back':
      return h('div', { class: 'el carry', 'data-node': id }, h('b', { text: 'Certificate file' }), 'Public, safe to copy');
    case 'flow.done':
      return h('div', { class: 'el banner', 'data-node': id, role: 'status', text: 'INSTALLED AND VERIFIED' });
    default:
      return card('', h('div', { text: id }));
  }
}

export function buildElement(id, ctx) {
  switch (elementType(id)) {
    case 'block': return block(id, ctx);
    case 'keymat': return keymat(id);
    case 'encoding': return encodingPanel(id, ctx);
    case 'heading': return heading(id);
    case 'flow': return flow(id, ctx);
    case 'plate': return plate(id, ctx);
    default: return null;
  }
}

export const PATH_COLORS = Object.freeze({
  approved: 'var(--cert)', carried: 'var(--cert)', policy: 'var(--csr)', consumed: 'var(--csr)',
  added: 'var(--ca)', derived: 'var(--derived)', config: 'var(--config)',
});

export { RELATIONSHIPS };
