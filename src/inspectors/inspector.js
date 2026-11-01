// Field inspector. Order: plain language, relationship, who and security,
// technical value, source classification, common failure. Raw views are
// available but closed by default.

import { h, groupHex } from '../ui/dom.js';
import { toHex, toBase64 } from '../asn1/der.js';
import { CATEGORIES } from '../anatomy/categories.js';
import { relationForNode } from '../anatomy/relationships.js';
import { asn1Outline } from './asn1-outline.js';

const RAW_MODES = [['hex', 'Hex'], ['base64', 'Base64'], ['asn1', 'ASN.1']];

function section(title, text, cls = '') {
  if (!text) return null;
  return h('section', { class: `insp-section ${cls}` }, h('h3', { text: title }), h('p', { text }));
}

function rawView(bytes, mode) {
  if (mode === 'hex') {
    const shown = bytes.subarray(0, 512);
    return groupHex(toHex(shown)) + (bytes.length > 512 ? `\n… ${bytes.length - 512} more bytes` : '');
  }
  if (mode === 'base64') {
    const b64 = toBase64(bytes.subarray(0, 768));
    return (b64.match(/.{1,64}/g) || []).join('\n') + (bytes.length > 768 ? '\n…' : '');
  }
  return asn1Outline(bytes).join('\n');
}

export function renderInspector(container, id, ctx, { dispatch, companion, rawMode = 'hex', rawOpen = false, onRawMode, onRawToggle }) {
  container.replaceChildren();
  if (!id) {
    container.hidden = true;
    return;
  }
  const node = ctx.node(id);
  const def = ctx.definition(id);
  if (!node || !def) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  const artifact = id.startsWith('csr') ? 'csr' : 'cert';
  const isCert = artifact === 'cert';
  const title = def.title || node.label;
  const cat = isCert ? def.category : null;
  const rel = relationForNode(id);
  const bytes = node.range ? ctx.bytes[artifact].subarray(node.range[0], node.range[1]) : null;

  const facts = isCert
    ? [['From the CSR?', def.facts.fromCsr], ['Signed?', def.facts.signed], ['Secret?', def.facts.secret]]
    : [['Covered by the CSR signature?', def.facts.signed], ['Secret?', def.facts.secret], ['Travels to the CA?', def.facts.travels]];

  // Technical value, read from the parsed artifact.
  let valueBlock = null;
  if (id === 'cert.thumbprint') {
    valueBlock = h('pre', { class: 'insp-value', text: `SHA-1    ${groupHex(ctx.fingerprints.certSha1)}\nSHA-256  ${groupHex(ctx.fingerprints.certSha256)}` });
  } else if (id === 'cert.tbs.spki' || id === 'csr.cri.spki' || id.endsWith('spki.publicKey')) {
    valueBlock = h('div', {},
      h('pre', { class: 'insp-value', text: node.value }),
      h('div', { class: 'fp-compare', style: { marginTop: '10px' } },
        h('div', { text: 'CSR public key, SHA-256 of SubjectPublicKeyInfo' }),
        h('div', { text: groupHex(ctx.fingerprints.csrSpkiSha256) }),
        h('div', { text: 'Certificate public key, same measurement' }),
        h('div', { text: groupHex(ctx.fingerprints.certSpkiSha256) }),
        h('div', { class: 'eq', text: ctx.fingerprints.spkiMatch ? 'Identical bytes: the certificate certifies the key from the CSR.' : 'Different' }),
      ));
  } else if (id === 'csr.privateKey') {
    valueBlock = h('pre', { class: 'insp-value', text: 'Not shown, not exported, not distributed.\nThis simulator never had APP01\'s private key: the fixtures were\nsigned in memory and the key was discarded.' });
  } else if (node.value) {
    valueBlock = h('pre', { class: 'insp-value', translate: 'no', text: `${node.value}${node.critical ? '\nCritical: yes' : ''}` });
  }

  const actions = [];
  if (rel && isCert && rel.csr) {
    actions.push(h('button', { class: 'btn small', type: 'button', onclick: () => dispatch({ type: 'compare', id }), text: 'Trace back to the CSR' }));
  }
  if (rel && !isCert && rel.cert) {
    actions.push(h('button', { class: 'btn small', type: 'button', onclick: () => dispatch({ type: 'compare', id }), text: 'See the certificate outcome' }));
  }
  if (rel && ((isCert && !rel.csr) || (!isCert && !rel.cert))) {
    actions.push(h('button', { class: 'btn small', type: 'button', onclick: () => dispatch({ type: 'compare', id }), text: 'Show in comparison' }));
  }
  if (id === 'cert') {
    if (companion?.available) {
      actions.push(h('button', { class: 'btn small', type: 'button', 'data-native-viewer': 'leaf', onclick: () => companion.open('leaf'), text: 'Open in Windows Certificate Viewer' }));
    }
  }

  const rawModes = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Raw view format' },
    RAW_MODES.map(([m, label]) => h('button', {
      type: 'button', 'aria-pressed': m === rawMode ? 'true' : 'false', text: label,
      onclick: () => onRawMode?.(m),
    })));

  const parts = [
    h('button', { class: 'tool insp-close', type: 'button', 'aria-label': 'Close explanation (Escape)', onclick: () => dispatch({ type: 'escape' }), text: 'Close' }),
    h('div', { class: 'insp-kind' },
      h('span', { text: isCert ? 'Issued certificate' : id === 'csr.privateKey' ? 'On APP01, outside the CSR' : 'Certificate signing request' }),
      node.asn1 ? h('span', { text: node.asn1 }) : null),
    h('h2', { class: 'insp-title', id: 'inspector-title', text: title }),
    h('p', { class: 'insp-lede', text: def.what }),
    section('Why it exists', def.why),
    section(isCert ? 'Where it came from' : 'How it relates to the issued certificate', def.relationship),
    rel ? h('section', { class: 'insp-section' }, h('h3', { text: 'Classification' }), h('p', { text: rel.classification })) : null,
    section(isCert ? 'Who selected or created it' : 'Who supplied it', def.who),
    section('Security meaning', def.security),
    h('dl', { class: 'insp-facts' }, facts.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])),
    valueBlock ? h('section', { class: 'insp-section' }, h('h3', { text: 'Technical value, parsed from the artifact' }), valueBlock) : null,
    cat ? h('section', { class: 'insp-section' },
      h('h3', { text: 'Source classification' }),
      h('span', { class: 'insp-badge', style: { '--cat': `var(--cat-${cat})` } }, h('i'), CATEGORIES[cat].label),
      h('p', { text: CATEGORIES[cat].description, style: { marginTop: '4px' } })) : null,
    isCert && def.validation ? section('Used during validation', def.validation) : null,
    section('Common failure', def.failure, 'insp-failure'),
    actions.length ? h('div', { class: 'insp-actions' }, actions) : null,
    id === 'cert' && !companion?.available
      ? h('p', { class: 'insp-section', style: { fontSize: '13px', color: 'var(--ink-3)' }, text: 'Native Windows Certificate Viewer is available when you run Certificate Anatomy locally with tools/windows/Launch-Demo.ps1.' })
      : null,
    bytes ? h('details', { class: 'insp-raw', open: rawOpen, ontoggle: (e) => onRawToggle?.(e.target.open) },
      h('summary', { text: `Raw encoding of this part (${bytes.length} bytes)` }),
      rawModes,
      h('pre', { class: 'insp-value', text: rawView(bytes, rawMode) })) : null,
  ];
  container.append(...parts.filter(Boolean));
}
