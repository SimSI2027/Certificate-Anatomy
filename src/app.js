// Interactive controller: state -> layout -> transition -> sampled frames.

import { initialState, reduce } from './state/machine.js';
import { computeFrame, staggerFor } from './motion/layout.js';
import { makeTransition, sample, isSettled, settled } from './motion/engine.js';
import { durationFor, stageDwell, changeKind } from './motion/choreography.js';
import { STAGGER } from './motion/tokens.js';
import { Renderer } from './ui/renderer.js';
import { Chrome } from './ui/chrome.js';
import { renderInspector } from './inspectors/inspector.js';
import { FLOW_STAGES } from './scenario/issuance.js';

export class App {
  constructor(root, ctx, { companion, clock = () => performance.now() } = {}) {
    this.root = root;
    this.ctx = ctx;
    this.clock = clock;
    this.companion = companion;
    this.state = initialState;
    this.filesOpen = false;
    this.rawMode = 'hex';
    this.rawOpen = false;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reduced = Boolean(mq?.matches);
    this.stage = root.querySelector('.stage');
    this.inspector = root.querySelector('.inspector');
    this.renderer = new Renderer(this.stage, ctx, { onActivate: (id) => this.dispatch({ type: 'activate', id }) });
    this.chrome = new Chrome(root, {
      dispatch: (a) => this.dispatch(a),
      ui: {
        toggleReduced: () => this.setReduced(!this.reduced),
        reduced: () => this.reduced,
        openFiles: () => { this.filesOpen = true; this.#renderChrome(); },
        closeFiles: () => { this.filesOpen = false; this.#renderChrome(); },
        filesOpen: () => this.filesOpen,
        companion,
      },
    });
    this.vp = this.#viewport();
    const frame = computeFrame(this.state, this.vp, ctx);
    this.transition = makeTransition(settled(frame), frame, { start: this.clock(), duration: 0 });
    this.stageStartedAt = this.clock();
    this.#bind();
    this.#renderChrome();
    this.#loop();
  }

  #viewport() {
    const r = this.stage.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }

  setReduced(v) {
    this.reduced = v;
    document.documentElement.dataset.reducedMotion = v ? 'true' : 'false';
    this.#retarget(this.state, { instant: true });
    this.#renderChrome();
  }

  dispatch(action) {
    const prev = this.state;
    const next = reduce(prev, action, this.ctx);
    if (next === prev) return;
    this.state = next;
    if (prev.selected !== next.selected) this.rawOpen = false;
    this.#retarget(prev);
    if (prev.flowStage !== next.flowStage || prev.scene !== next.scene || (!prev.playing && next.playing)) {
      this.stageStartedAt = this.clock();
    }
    this.#renderChrome();
    if (prev.selected !== next.selected && next.selected && action.type === 'activate') {
      // Keep focus on the field the learner selected; the inspector is announced via its heading.
      this.inspector.setAttribute('aria-labelledby', 'inspector-title');
    }
  }

  #retarget(prev, { instant = false } = {}) {
    const now = this.clock();
    const from = sample(this.transition, now);
    const to = computeFrame(this.state, this.vp, this.ctx);
    const duration = instant ? 0 : durationFor(prev, this.state, { reduced: this.reduced });
    const delays = duration ? staggerFor(prev, this.state, this.ctx, to, { STAGGER }) : {};
    this.transition = makeTransition(from, to, { start: now, duration, delays });
    this.lastChange = changeKind(prev, this.state);
  }

  #renderChrome() {
    const inspectorScene = ['cert', 'csr', 'compare'].includes(this.state.scene);
    this.root.classList.toggle('has-inspector', Boolean(this.state.selected) && inspectorScene);
    this.chrome.render(this.state);
    renderInspector(this.inspector, this.state.selected, this.ctx, {
      dispatch: (a) => this.dispatch(a),
      companion: this.companion,
      rawMode: this.rawMode,
      rawOpen: this.rawOpen,
      onRawMode: (m) => { this.rawMode = m; this.rawOpen = true; this.#renderChrome(); },
      onRawToggle: (open) => { this.rawOpen = open; },
    });
  }

  #loop() {
    const tick = () => {
      const now = this.clock();
      const frame = sample(this.transition, now);
      this.renderer.apply(frame);
      this.frame = frame;
      if (this.state.playing && this.state.scene === 'flow') {
        const dwell = stageDwell(this.state.flowStage, this.reduced);
        if (now - this.stageStartedAt >= dwell) {
          if (this.state.flowStage < FLOW_STAGES.length - 1) this.dispatch({ type: 'next' });
          else this.dispatch({ type: 'pause' });
        }
      }
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  settled() {
    return isSettled(this.transition, this.clock());
  }

  #bind() {
    this.stage.addEventListener('click', (ev) => {
      if (ev.target === this.stage || ev.target.classList.contains('camera') || ev.target.classList.contains('world')) {
        this.dispatch({ type: 'background' });
      }
    });
    window.addEventListener('keydown', (ev) => {
      const tag = ev.target?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';
      if (ev.key === 'Escape') {
        if (this.filesOpen) { this.filesOpen = false; this.#renderChrome(); return; }
        const sel = this.state.selected;
        this.dispatch({ type: 'escape' });
        // Return focus to the field whose explanation just closed.
        if (sel && !this.state.selected) this.stage.querySelector(`[data-node="${sel}"]`)?.focus();
        ev.preventDefault();
        return;
      }
      if (inField || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const onButton = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
      if (ev.key === '?') { this.dispatch({ type: 'help' }); ev.preventDefault(); }
      else if ((ev.key === 'p' || ev.key === 'P') && this.state.scene === 'flow') {
        this.dispatch({ type: this.state.playing ? 'pause' : 'play' });
      } else if (ev.key === 'ArrowRight' && !onButton) this.dispatch({ type: 'next' });
      else if (ev.key === 'ArrowLeft' && !onButton) this.dispatch({ type: 'prev' });
    });
    const ro = new ResizeObserver(() => {
      const vp = this.#viewport();
      if (vp.w === this.vp.w && vp.h === this.vp.h) return;
      this.vp = vp;
      this.#retarget(this.state, { instant: true });
    });
    ro.observe(this.stage);
  }
}
