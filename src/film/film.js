// Film page. window.renderAt(t) renders the exact frame for time t (seconds).
// Every frame is a pure function of t: no clocks, no randomness, no CSS transitions.

import '../ui/styles.css';
import './film.css';
import { loadBrowserContext } from '../artifacts/fixtures.js';
import { Renderer } from '../ui/renderer.js';
import { h } from '../ui/dom.js';
import { FILM, CAPTIONS, TITLE_CARDS, FILM_VIEWPORT, FILM_SCALE, buildShots, frameAt, overlayOpacity, shotIndexAt } from './timeline.js';

const params = new URLSearchParams(location.search);
const capture = params.has('capture');

const ctx = loadBrowserContext();
const shots = buildShots(ctx);

const root = document.getElementById('film-root');
const frameEl = h('div', { class: 'film-frame', style: { width: `${FILM.width}px`, height: `${FILM.height}px` } });
const stage = h('div', { class: 'stage film-stage', style: {
  width: `${FILM_VIEWPORT.w}px`, height: `${FILM_VIEWPORT.h}px`, transform: `scale(${FILM_SCALE})`, transformOrigin: '0 0',
} }, h('div', { class: 'camera' }, h('div', { class: 'world' })));
stage.querySelector('.world').innerHTML = '<svg class="links" aria-hidden="true" width="100%" height="100%"></svg>';
const brand = h('div', { class: 'film-brand', text: 'Certificate Anatomy' });
const capBox = h('div', { class: 'film-caption' }, h('div', { class: 'fc-title' }), h('p', { class: 'fc-text' }));
const card = h('div', { class: 'film-card' }, h('h1'), h('p'));
const progress = h('div', { class: 'film-progress' }, h('i'));
frameEl.append(stage, brand, capBox, card, progress);
root.append(frameEl);

const renderer = new Renderer(stage, ctx);

let lastCaption = null;
let lastCard = null;

function renderAt(t) {
  const time = Math.max(0, Math.min(FILM.duration, Number(t) || 0));
  renderer.apply(frameAt(time, shots, ctx));

  const cap = CAPTIONS.find((c) => time >= c.start && time <= c.end) || null;
  if (cap !== lastCaption) {
    capBox.querySelector('.fc-title').textContent = cap ? cap.title : '';
    capBox.querySelector('.fc-text').textContent = cap ? cap.text : '';
    lastCaption = cap;
  }
  capBox.style.opacity = cap ? String(Math.round(overlayOpacity(cap, time) * 1000) / 1000) : '0';

  const tc = TITLE_CARDS.find((c) => time >= c.start && time <= c.end) || null;
  if (tc !== lastCard) {
    card.querySelector('h1').textContent = tc ? tc.title : '';
    card.querySelector('p').textContent = tc ? tc.text : '';
    card.dataset.kind = tc ? tc.kind : '';
    lastCard = tc;
  }
  // The opening title holds fully at t=0 so the first frame is never blank.
  const cardOpacity = tc ? (tc.kind === 'title' ? Math.min(1, (tc.end - time) / 0.35) : overlayOpacity(tc, time)) : 0;
  card.style.opacity = String(Math.round(cardOpacity * 1000) / 1000);
  progress.firstChild.style.width = `${(time / FILM.duration) * 100}%`;
  return shotIndexAt(time, shots);
}

window.renderAt = renderAt;
window.filmInfo = { ...FILM, shots: shots.map((s) => ({ t: s.t, label: s.label })) };

function fit() {
  if (capture) return;
  const s = Math.min(window.innerWidth / FILM.width, (window.innerHeight - 64) / FILM.height);
  frameEl.style.transform = `scale(${s})`;
}

document.fonts.ready.then(() => {
  renderAt(0);
  window.filmReady = true;
});

if (!capture) {
  document.body.classList.add('film-preview');
  let playing = false;
  let t0 = 0;
  let base = 0;
  const scrub = h('input', { type: 'range', min: '0', max: String(FILM.duration), step: '0.01', value: '0', 'aria-label': 'Film time' });
  const play = h('button', { class: 'btn small primary', type: 'button', text: 'Play' });
  const time = h('span', { class: 'film-time', text: '0.0 s' });
  const back = h('a', { class: 'btn small', href: './', text: 'Back to the interactive app' });
  const bar = h('div', { class: 'film-controls' }, play, scrub, time, back);
  document.body.append(bar);
  const show = (t) => {
    renderAt(t);
    scrub.value = String(t);
    time.textContent = `${t.toFixed(1)} s`;
  };
  play.addEventListener('click', () => {
    playing = !playing;
    play.textContent = playing ? 'Pause' : 'Play';
    base = Number(scrub.value) >= FILM.duration ? 0 : Number(scrub.value);
    t0 = performance.now();
  });
  scrub.addEventListener('input', () => {
    playing = false;
    play.textContent = 'Play';
    show(Number(scrub.value));
  });
  const loop = () => {
    if (playing) {
      const t = base + (performance.now() - t0) / 1000;
      if (t >= FILM.duration) {
        playing = false;
        play.textContent = 'Play';
      }
      show(Math.min(FILM.duration, t));
    }
    requestAnimationFrame(loop);
  };
  loop();
  window.addEventListener('resize', fit);
  fit();
}
