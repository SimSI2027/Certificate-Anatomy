// Persistent and contextual controls. Kept minimal: only what the current mode needs.

import { h } from './dom.js';
import { STEPS, isTraceMode } from '../state/machine.js';
import { FLOW_STAGES } from '../scenario/issuance.js';
import { CATEGORIES, CERT_CATEGORY_ORDER, VALIDATION } from '../anatomy/categories.js';
import { CERTIFICATE_FIELDS } from '../anatomy/certificate-fields.js';
import { captionFor, OPENING } from './captions.js';
import { traceMatches } from '../motion/layout.js';
import { DOWNLOADS } from '../artifacts/fixtures.js';

const ENCODING_LABELS = [['structure', 'Structure'], ['hex', 'DER hex'], ['base64', 'Base64'], ['pem', 'PEM']];

function preserveFocus(container, render) {
  const key = document.activeElement && container.contains(document.activeElement) ? document.activeElement.dataset.key : null;
  render();
  if (key) container.querySelector(`[data-key="${key}"]`)?.focus();
}

const btn = (key, label, onclick, cls = 'btn') => h('button', { class: cls, type: 'button', 'data-key': key, onclick, text: label });

export class Chrome {
  constructor(root, { dispatch, ui }) {
    this.root = root;
    this.dispatch = dispatch;
    this.ui = ui; // { toggleReduced, openFiles, closeFiles, filesOpen, reduced, companion }
    this.topbar = root.querySelector('.topbar');
    this.bottom = root.querySelector('.bottombar');
    this.opening = root.querySelector('.opening');
    this.legend = root.querySelector('.legend');
    this.overlay = root.querySelector('.overlay');
    this.live = root.querySelector('#live');
    this.#buildTopbar();
    this.lastCaption = '';
  }

  #buildTopbar() {
    const d = this.dispatch;
    this.stepButtons = STEPS.map((s, i) =>
      h('li', {}, h('button', { type: 'button', 'data-key': `step-${i}`, 'data-step': i, onclick: () => d({ type: 'goStep', step: i }) },
        h('span', { class: 'n', text: String(i + 1) }), h('span', { class: 't', text: s.title }))));
    this.reducedBtn = h('button', { class: 'tool', type: 'button', 'aria-pressed': 'false', onclick: () => this.ui.toggleReduced(), text: 'Reduced motion' });
    this.compareBtn = h('button', { class: 'tool wide', type: 'button', onclick: () => d({ type: 'compare' }), text: 'Compare' });
    this.filesBtn = h('button', { class: 'tool wide', type: 'button', onclick: () => this.ui.openFiles(), text: 'Files' });
    this.helpBtn = h('button', { class: 'tool', type: 'button', 'aria-haspopup': 'dialog', onclick: () => d({ type: 'help' }), text: 'Help' });
    this.topbar.replaceChildren(
      h('button', { class: 'wordmark', type: 'button', onclick: () => d({ type: 'goStep', step: 0 }), text: 'Certificate Anatomy' }),
      h('nav', { 'aria-label': 'Learning steps', style: { flex: '1', minWidth: '0', display: 'flex' } }, h('ol', { class: 'steps' }, this.stepButtons)),
      h('div', { class: 'tools' }, this.compareBtn, this.filesBtn, this.reducedBtn, this.helpBtn),
    );
  }

  render(state) {
    const d = this.dispatch;
    // Steps rail.
    this.stepButtons.forEach((li, i) => {
      const b = li.firstChild;
      const current = state.scene !== 'compare' && i === state.step;
      li.classList.toggle('current', current);
      if (current) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
      b.classList.toggle('done', i < state.step);
    });
    this.compareBtn.setAttribute('aria-pressed', state.scene === 'compare' ? 'true' : 'false');
    this.reducedBtn.setAttribute('aria-pressed', this.ui.reduced() ? 'true' : 'false');

    // Opening question, only on the untouched certificate.
    const opening = state.scene === 'cert' && state.step === 0 && !state.cert.exploded;
    this.opening.hidden = !opening;
    this.opening.replaceChildren(h('p', { class: 'opening-q', text: OPENING.question }));

    this.#renderLegend(state);
    preserveFocus(this.bottom, () => this.#renderBottom(state, d));
    this.#renderOverlay(state);

    const cap = captionFor(state);
    const text = `${cap.title}. ${cap.text}`;
    if (text !== this.lastCaption) {
      this.live.textContent = text;
      this.lastCaption = text;
    }
  }

  #renderLegend(state) {
    const show = isTraceMode(state);
    this.legend.hidden = !show;
    if (!show) return;
    const count = (cat) => Object.keys(CERTIFICATE_FIELDS).filter((id) => traceMatches(id, cat)).length;
    const chips = [...CERT_CATEGORY_ORDER.map((c) => CATEGORIES[c]), VALIDATION].map((c) =>
      h('button', {
        class: 'chip', type: 'button', 'data-key': `chip-${c.id}`, 'data-cat': c.id,
        'aria-pressed': state.traceFilter === c.id ? 'true' : 'false',
        style: { '--cat': c.id === 'validation' ? 'transparent' : `var(--cat-${c.id})` },
        title: c.description,
        onclick: () => this.dispatch({ type: 'traceFilter', category: c.id }),
      }, h('i'), c.label, h('span', { class: 'count', text: String(count(c.id)) })));
    preserveFocus(this.legend, () => this.legend.replaceChildren(...chips));
  }

  #renderBottom(state, d) {
    const cap = captionFor(state);
    const caption = h('div', { class: 'caption' },
      h('div', { class: 'cap-title', text: cap.title }),
      h('p', { text: cap.text }));
    const actions = [];
    const encoding = () => h('div', { class: 'segmented', role: 'group', 'aria-label': 'View as' },
      ENCODING_LABELS.map(([m, label]) => h('button', {
        type: 'button', 'data-key': `enc-${m}`, 'aria-pressed': state.encoding === m ? 'true' : 'false', text: label,
        onclick: () => d({ type: 'setEncoding', mode: m }),
      })));

    if (state.scene === 'cert') {
      if (!state.cert.exploded) {
        actions.push(btn('open-cert', 'Open the certificate', () => d({ type: 'activate', id: 'cert' }), 'btn primary'));
        actions.push(btn('watch', 'Watch how it was created', () => d({ type: 'play' })));
      } else if (state.step === 2) {
        actions.push(encoding());
        actions.push(btn('compare', 'Compare side by side', () => d({ type: 'compare' })));
        actions.push(btn('to-csr', 'Open the CSR', () => d({ type: 'goStep', step: 3 }), 'btn primary'));
      } else {
        actions.push(encoding());
        actions.push(btn('trace', 'Trace back to request', () => d({ type: 'goStep', step: 2 }), 'btn primary'));
      }
    } else if (state.scene === 'csr') {
      if (!state.csr.exploded) {
        actions.push(btn('open-csr', 'Open the CSR', () => d({ type: 'activate', id: 'csr' }), 'btn primary'));
        actions.push(btn('play', 'Play the manual issuance', () => d({ type: 'play' })));
      } else {
        actions.push(encoding());
        actions.push(btn('compare', 'Compare with the certificate', () => d({ type: 'compare' })));
        actions.push(btn('play', 'Play the manual issuance', () => d({ type: 'play' }), 'btn primary'));
      }
    } else if (state.scene === 'compare') {
      actions.push(btn('back-cert', 'Back to the certificate', () => d({ type: 'goStep', step: 2 })));
      actions.push(btn('to-csr', 'Open the CSR', () => d({ type: 'goStep', step: 3 })));
      actions.push(btn('play', 'Play the manual issuance', () => d({ type: 'play' }), 'btn primary'));
    } else if (state.scene === 'flow') {
      const last = state.flowStage === FLOW_STAGES.length - 1;
      if (last) {
        actions.push(btn('again-cert', 'Inspect certificate again', () => d({ type: 'goStep', step: 1 })));
        actions.push(btn('again-csr', 'Inspect CSR again', () => d({ type: 'goStep', step: 3 })));
        actions.push(btn('replay', 'Replay issuance', () => d({ type: 'flowRestart' })));
        actions.push(btn('compare', 'Compare CSR and certificate', () => d({ type: 'compare' }), 'btn primary'));
      } else {
        actions.push(h('div', { class: 'transport', role: 'group', 'aria-label': 'Issuance playback' },
          h('span', { class: 'stage-name', text: `${state.flowStage + 1} of ${FLOW_STAGES.length}` }),
          btn('restart', 'Restart', () => d({ type: 'flowRestart' }), 'btn small'),
          btn('prev', 'Previous', () => d({ type: 'prev' }), 'btn small'),
          state.playing
            ? btn('pause', 'Pause', () => d({ type: 'pause' }), 'btn small primary')
            : btn('play', 'Play', () => d({ type: 'play' }), 'btn small primary'),
          btn('next', 'Next', () => d({ type: 'next' }), 'btn small'),
        ));
      }
    }
    this.bottom.replaceChildren(caption, h('div', { class: 'actions' }, actions));
  }

  #renderOverlay(state) {
    const files = this.ui.filesOpen();
    const show = state.help || files;
    const wasHidden = this.overlay.hidden;
    this.overlay.hidden = !show;
    if (!show) return;
    const close = () => (state.help ? this.dispatch({ type: 'help' }) : this.ui.closeFiles());
    const companion = this.ui.companion;
    const body = files
      ? [
        h('h2', { id: 'dialog-title', text: 'Synthetic artifacts' }),
        h('p', { text: 'Every file is synthetic and public. No private key, PFX or P12 file exists in this project: keys were generated in memory and discarded.' }),
        h('ul', { class: 'files' }, DOWNLOADS.map((f) => h('li', {},
          h('a', { href: f.url, download: f.file, 'data-download': f.id, text: `${f.label} (${f.file})` }), h('small', { text: f.note })))),
        h('h3', { text: 'Windows Certificate Viewer' }),
        companion.available
          ? h('p', {}, h('button', { class: 'btn small', type: 'button', 'data-native-viewer': 'leaf', onclick: () => companion.open('leaf'), text: 'Open the issued certificate in Windows Certificate Viewer' }))
          : h('p', { text: 'Native viewing is available when you run Certificate Anatomy locally with tools/windows/Launch-Demo.ps1. This public page works completely without it.' }),
      ]
      : [
        h('h2', { id: 'dialog-title', text: 'How to use Certificate Anatomy' }),
        h('p', { text: 'Select an artifact to take it apart, select it again to rebuild it exactly. Select a layer to open its parts, and any field to read what it is, who set it and how it is checked.' }),
        h('h3', { text: 'Keyboard' }),
        h('ul', {},
          h('li', {}, h('kbd', { text: 'Tab' }), ' moves through the visible fields; ', h('kbd', { text: 'Enter' }), ' or ', h('kbd', { text: 'Space' }), ' selects.'),
          h('li', {}, h('kbd', { text: 'Esc' }), ' steps back one level: explanation, open layer, whole artifact.'),
          h('li', {}, h('kbd', { text: '←' }), ' ', h('kbd', { text: '→' }), ' previous and next step. ', h('kbd', { text: 'P' }), ' plays or pauses the issuance.'),
          h('li', {}, h('kbd', { text: '?' }), ' opens this help.')),
        h('h3', { text: 'Colours' }),
        h('p', { text: 'Teal is the issued certificate, amber is the request, steel blue is the Issuing CA, red is private-key material. In the trace view, each certificate field is coloured by where it came from.' }),
        h('h3', { text: 'About the data' }),
        h('p', { text: 'All names, dates and artifacts are synthetic (simsi2027.test). The certificate, CSR, chain and CRL are real, verifiable structures generated for this project. Commands are shown for learning and are never executed.' }),
      ];
    this.overlay.replaceChildren(h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dialog-title' },
      h('button', { class: 'tool close', type: 'button', onclick: close, text: 'Close' }), ...body));
    if (wasHidden) this.overlay.querySelector('.close')?.focus();
  }
}
