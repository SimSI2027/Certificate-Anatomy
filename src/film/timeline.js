// Deterministic film timeline. Each shot is a real application state reached
// through the same reducer the learner drives, so the film can never show a
// state the interactive app cannot reach.

import { initialState, reduce } from '../state/machine.js';
import { computeFrame, staggerFor } from '../motion/layout.js';
import { makeTransition, sample, settled } from '../motion/engine.js';
import { durationFor } from '../motion/choreography.js';
import { STAGGER } from '../motion/tokens.js';

export const FILM = Object.freeze({
  version: '0.1.0',
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 70, // seconds
  video: 'output/certificate-anatomy-v0.1.0.mp4',
  contactSheet: 'output/certificate-anatomy-v0.1.0-contact-sheet.jpg',
});

/** Shot list: time (s) the transition into the state begins, plus actions. */
const SCRIPT = [
  { t: 0, label: 'Signed certificate', actions: [] },
  { t: 7.0, label: 'Certificate explodes', actions: [{ type: 'activate', id: 'cert' }] },
  { t: 9.0, label: 'TBSCertificate unfolds', actions: [{ type: 'activate', id: 'cert.tbs' }] },
  { t: 10.6, label: 'Extensions unfold', actions: [{ type: 'activate', id: 'cert.tbs.extensions' }, { type: 'select', id: null }] },
  { t: 12.2, label: 'SAN inspected', actions: [{ type: 'select', id: 'cert.ext.san' }] },
  { t: 15.2, label: 'Signature inspected', actions: [{ type: 'select', id: 'cert.sigValue' }] },
  { t: 18.2, label: 'Trace to CSR', actions: [{ type: 'goStep', step: 2 }] },
  { t: 21.8, label: 'Field relationships', actions: [{ type: 'compare' }] },
  { t: 25.6, label: 'CSR', actions: [{ type: 'goStep', step: 3 }] },
  { t: 27.6, label: 'CSR explodes', actions: [{ type: 'activate', id: 'csr' }] },
  { t: 29.0, label: 'Request body unfolds', actions: [{ type: 'activate', id: 'csr.cri' }, { type: 'select', id: null }] },
  { t: 30.4, label: 'Public key, private key stays', actions: [{ type: 'activate', id: 'csr.cri.spki' }, { type: 'select', id: 'csr.cri.spki.publicKey' }] },
  { t: 33.6, label: 'CSR created', actions: [{ type: 'flowGo', stage: 0 }] },
  { t: 36.6, label: 'CSR submitted', actions: [{ type: 'flowGo', stage: 1 }] },
  { t: 39.6, label: 'Request evaluated', actions: [{ type: 'flowGo', stage: 2 }] },
  { t: 43.2, label: 'New certificate signed', actions: [{ type: 'flowGo', stage: 3 }] },
  { t: 47.8, label: 'Certificate returned', actions: [{ type: 'flowGo', stage: 4 }] },
  { t: 50.8, label: 'Installed', actions: [{ type: 'flowGo', stage: 5 }] },
  { t: 53.4, label: 'Private key matched', actions: [{ type: 'flowGo', stage: 6 }] },
  { t: 56.4, label: 'Verified', actions: [{ type: 'flowGo', stage: 7 }] },
  { t: 61.6, label: 'Certificate again', actions: [{ type: 'goStep', step: 1 }] },
  { t: 63.6, label: 'Certificate reassembles', actions: [{ type: 'activate', id: 'cert' }] },
];

export const CAPTIONS = Object.freeze([
  { start: 3.0, end: 6.8, title: 'Signed certificate', text: 'This block of encoded data holds an identity, public key, policy result, trust path and signature.' },
  { start: 7.4, end: 11.9, title: 'Certificate anatomy', text: 'It separates into a signed body, an algorithm, and the Issuing CA\'s signature. The body holds the fields the CA vouched for.' },
  { start: 12.5, end: 15.0, title: 'Subject Alternative Name', text: 'The DNS names a TLS client checks: app.simsi2027.test and www.app.simsi2027.test.' },
  { start: 15.5, end: 18.0, title: 'Certificate signature', text: 'Made with the Issuing CA private key, not by APP01.' },
  { start: 18.6, end: 21.6, title: 'Trace to CSR', text: 'Coloured by origin: approved from the request, added or derived by the CA, or configured.' },
  { start: 22.2, end: 25.6, title: 'Field relationships', text: 'Only subject, key, names and purposes came from the CSR. The CA supplied the rest.' },
  { start: 25.9, end: 30.0, title: 'CSR anatomy', text: 'The request APP01 built first, signed with its own private key as proof of possession.' },
  { start: 30.7, end: 33.4, title: 'Public key', text: 'The public key travels in the CSR. The private key stays on APP01.' },
  { start: 34.0, end: 36.4, title: 'CSR created', text: 'certreq on APP01 creates the key pair and signed CSR together.' },
  { start: 37.0, end: 39.4, title: 'CSR submitted', text: 'The Administrator carries the CSR to the CA. Only public data travels.' },
  { start: 40.0, end: 43.0, title: 'Request evaluated', text: 'The Issuing CA checks the signature, the requester\'s permission and the template rules.' },
  { start: 43.6, end: 47.6, title: 'Certificate issued', text: 'A separate, new certificate: approved values copied in, CA fields added, Issuing CA signature applied. Root stays offline.' },
  { start: 48.2, end: 50.6, title: 'Certificate returned', text: 'The certificate is public, so it travels back to APP01 freely.' },
  { start: 51.2, end: 53.2, title: 'Certificate installed', text: 'Local Computer › Personal › Certificates.' },
  { start: 53.8, end: 56.2, title: 'Private key matched', text: 'Matching public keys link the certificate to the key. It never moved.' },
  { start: 56.8, end: 61.2, title: 'Verification', text: 'Key, names, purposes, dates, signature, chain, root trust and revocation information all check out.' },
  { start: 63.8, end: 66.4, title: 'Reassembled', text: 'Every field accounted for. The certificate rebuilds exactly as it began.' },
]);

export const TITLE_CARDS = Object.freeze([
  { start: 0, end: 3.0, kind: 'title', title: 'Certificate Anatomy', text: 'A CSR and the certificate issued from it, taken apart field by field.' },
  { start: 66.8, end: 70, kind: 'end', title: 'Installed and verified.', text: 'simsi2027.github.io/Certificate-Anatomy · synthetic data only' },
]);

/** Build the keyframe states. ctx supplies the tree index for the reducer. */
export function buildShots(ctx) {
  let state = initialState;
  return SCRIPT.map((shot) => {
    for (const a of shot.actions) state = reduce(state, a, ctx);
    state = { ...state, playing: false };
    return { t: shot.t, label: shot.label, state };
  });
}

/** Viewport used for every film frame: the inspector is never reserved. */
// Layout happens on a 1440x810 virtual stage that the film scales by 4/3, so
// field text stays legible at 1080p.
export const FILM_VIEWPORT = Object.freeze({ w: 1440, h: 810, film: true });
export const FILM_SCALE = FILM.width / FILM_VIEWPORT.w;

export function transitionWindows(shots) {
  return shots.map((s, i) => {
    if (i === 0) return { start: s.t, end: s.t };
    const ms = durationFor(shots[i - 1].state, s.state);
    return { start: s.t, end: s.t + ms / 1000 };
  });
}

/** Pure: the exact frame at time t (seconds). */
export function frameAt(t, shots, ctx, vp = FILM_VIEWPORT) {
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
  const to = computeFrame(shots[i].state, vp, ctx);
  if (i === 0) return settled(to);
  const prev = shots[i - 1].state;
  const from = settled(computeFrame(prev, vp, ctx));
  const duration = durationFor(prev, shots[i].state);
  const delays = staggerFor(prev, shots[i].state, ctx, to, { STAGGER });
  const tr = makeTransition(from, to, { start: shots[i].t * 1000, duration, delays });
  return sample(tr, t * 1000);
}

/** Linear fade for captions and cards (deterministic). */
export function overlayOpacity(item, t, fade = 0.35) {
  if (t < item.start || t > item.end) return 0;
  return Math.min(1, (t - item.start) / fade, (item.end - t) / fade);
}

export function shotIndexAt(t, shots) {
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
  return i;
}
