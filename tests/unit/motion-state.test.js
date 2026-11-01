import { describe, it, expect } from 'vitest';
import { nodeContext, VP } from '../helpers/context.js';
import { initialState, reduce, escape, goStep, STEPS } from '../../src/state/machine.js';
import { computeFrame, columnPlan, safeArea, flowZones } from '../../src/motion/layout.js';
import { makeTransition, sample, settled } from '../../src/motion/engine.js';
import { durationFor, changeKind, stageDwell } from '../../src/motion/choreography.js';
import { DURATION, EASE } from '../../src/motion/tokens.js';
import { cubicBezier } from '../../src/motion/easing.js';
import { captionFor } from '../../src/ui/captions.js';

const ctx = nodeContext();
const run = (actions, s = initialState) => actions.reduce((st, a) => reduce(st, a, ctx), s);
const act = (id) => ({ type: 'activate', id });

describe('state machine', () => {
  it('starts with the assembled signed certificate', () => {
    expect(initialState.scene).toBe('cert');
    expect(initialState.cert.exploded).toBe(false);
    expect(STEPS).toHaveLength(8);
  });
  it('explodes the certificate on click and advances to Certificate anatomy', () => {
    const s = run([act('cert')]);
    expect(s.cert.exploded).toBe(true);
    expect(s.step).toBe(1);
  });
  it('unfolds nested structures and keeps one open branch per depth', () => {
    let s = run([act('cert'), act('cert.tbs'), act('cert.tbs.extensions')]);
    expect(s.cert.open).toEqual(['cert.tbs', 'cert.tbs.extensions']);
    s = reduce(s, act('cert.tbs.validity'), ctx);
    expect(s.cert.open).toEqual(['cert.tbs', 'cert.tbs.validity']);
  });
  it('selects a field without collapsing the artifact, and switches selections cleanly', () => {
    let s = run([act('cert'), act('cert.tbs'), act('cert.tbs.extensions'), act('cert.ext.san')]);
    expect(s.selected).toBe('cert.ext.san');
    s = reduce(s, act('cert.ext.cdp'), ctx);
    expect(s.selected).toBe('cert.ext.cdp');
    expect(s.cert.open).toEqual(['cert.tbs', 'cert.tbs.extensions']);
  });
  it('Escape climbs exactly one level at a time', () => {
    let s = run([act('cert'), act('cert.tbs'), act('cert.tbs.extensions'), act('cert.ext.san')]);
    s = escape(s); expect(s.selected).toBeNull(); expect(s.cert.open).toHaveLength(2);
    s = escape(s); expect(s.cert.open).toEqual(['cert.tbs']);
    s = escape(s); expect(s.cert.open).toEqual([]); expect(s.cert.exploded).toBe(true);
    s = escape(s); expect(s.cert.exploded).toBe(false); expect(s.step).toBe(0);
  });
  it('Escape on the assembled CSR exits focused mode', () => {
    const s = escape(goStep(initialState, 3));
    expect(s.scene).toBe('cert');
    expect(s.step).toBe(0);
  });
  it('clicking the exploded artifact header reassembles it', () => {
    const s = run([act('cert'), act('cert.tbs'), act('cert')]);
    expect(s.cert.exploded).toBe(false);
    expect(s.cert.open).toEqual([]);
  });
  it('ignores clicks on artifacts that are not active', () => {
    const s = run([act('csr.cri')]);
    expect(s).toBe(initialState);
  });
  it('maps flow stages to the four flow steps', () => {
    expect(run([{ type: 'flowGo', stage: 0 }]).step).toBe(4);
    expect(run([{ type: 'flowGo', stage: 3 }]).step).toBe(5);
    expect(run([{ type: 'flowGo', stage: 5 }]).step).toBe(6);
    expect(run([{ type: 'flowGo', stage: 7 }]).step).toBe(7);
  });
  it('play, pause, next, previous and restart drive the flow', () => {
    let s = run([{ type: 'play' }]);
    expect(s.scene).toBe('flow'); expect(s.playing).toBe(true); expect(s.flowStage).toBe(0);
    s = reduce(s, { type: 'next' }, ctx); expect(s.flowStage).toBe(1);
    s = reduce(s, { type: 'pause' }, ctx); expect(s.playing).toBe(false);
    s = reduce(s, { type: 'prev' }, ctx); expect(s.flowStage).toBe(0);
    s = reduce(s, { type: 'flowRestart' }, ctx); expect(s.flowStage).toBe(0); expect(s.playing).toBe(true);
    s = reduce(s, { type: 'flowGo', stage: 7 }, ctx); expect(s.playing).toBe(false);
  });
});

describe('layout and reassembly', () => {
  const home = computeFrame(initialState, VP, ctx);

  it('is a pure function of state', () => {
    expect(computeFrame(initialState, VP, ctx)).toEqual(home);
  });
  it('reassembles to exactly the original assembled position after any explore sequence', () => {
    const explored = run([act('cert'), act('cert.tbs'), act('cert.tbs.extensions'), act('cert.ext.san'),
      { type: 'escape' }, act('cert.tbs.validity'), act('cert')]);
    const back = computeFrame(explored, VP, ctx);
    expect(back.els.cert).toEqual(home.els.cert);
    for (const id of ['cert.tbs', 'cert.sigAlg', 'cert.sigValue']) expect(back.els[id]).toEqual(home.els[id]);
    expect(back.cam).toEqual(home.cam);
  });
  it('an explode then reassemble transition ends exactly on the assembled frame', () => {
    const exploded = computeFrame(run([act('cert')]), VP, ctx);
    const tr = makeTransition(settled(exploded), home, { start: 0, duration: DURATION.collapse });
    const end = sample(tr, DURATION.collapse);
    for (const id of Object.keys(home.els)) {
      for (const k of ['x', 'y', 'w', 'h', 'z', 'k', 'o']) expect(end.els[id][k]).toBeCloseTo(home.els[id][k] ?? (k === 'k' ? 1 : 0), 9);
    }
  });
  it('separates the three certificate layers when exploded', () => {
    const f = computeFrame(run([act('cert')]), VP, ctx);
    const ys = ['cert.tbs', 'cert.sigAlg', 'cert.sigValue'].map((id) => f.els[id].y);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(f.els['cert.tbs.version'].o).toBe(0);
    expect(f.cam.rx).toBe(0);
    expect(home.cam.rx).not.toBe(0);
  });
  it('places unfolded children in a new column to the right of their parent', () => {
    const f = computeFrame(run([act('cert'), act('cert.tbs')]), VP, ctx);
    const p = f.els['cert.tbs'];
    expect(f.els['cert.tbs.serial'].x).toBeGreaterThan(p.x + p.w);
    expect(f.els['cert.tbs.serial'].o).toBe(1);
  });
  it('collapses leading columns to spines when space runs out', () => {
    expect(columnPlan(2, 1200).spines).toBe(0);
    expect(columnPlan(4, 700).spines).toBeGreaterThan(0);
  });
  it('keeps the CSR private key visibly separate from the CSR block', () => {
    const f = computeFrame(goStep(initialState, 3), VP, ctx);
    const k = f.els['csr.privateKey'], b = f.els.csr;
    expect(k.x + k.w * k.k).toBeLessThan(b.x);
  });
  it('reserves room for the inspector only while a field is selected', () => {
    const s = run([act('cert'), act('cert.tbs')]);
    expect(safeArea(s, VP).inspector).toBeGreaterThan(0);
    expect(safeArea(escape(s), VP).inspector).toBe(0);
  });
});

describe('motion engine', () => {
  it('cubic-bezier hero easing is monotonic with no overshoot', () => {
    const e = cubicBezier(...EASE.hero);
    let prev = 0;
    for (let i = 0; i <= 100; i++) {
      const v = e(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
      prev = v;
    }
  });
  it('samples deterministically', () => {
    const a = computeFrame(initialState, VP, ctx);
    const b = computeFrame(run([act('cert')]), VP, ctx);
    const tr = makeTransition(settled(a), b, { start: 1000, duration: 900 });
    expect(sample(tr, 1450)).toEqual(sample(tr, 1450));
    expect(sample(tr, 1450).els.cert.y).not.toBe(a.els.cert.y);
  });
  it('reduced motion makes every change instant', () => {
    expect(durationFor(initialState, run([act('cert')]), { reduced: true })).toBe(0);
    expect(durationFor(initialState, run([act('cert')]))).toBe(DURATION.explode);
  });
  it('classifies change kinds', () => {
    const a = run([act('cert')]);
    expect(changeKind(initialState, a)).toBe('explode');
    expect(changeKind(a, initialState)).toBe('collapse');
    expect(changeKind(a, reduce(a, act('cert.tbs'), ctx))).toBe('unfold');
    expect(changeKind(a, goStep(a, 4))).toBe('scene');
    expect(stageDwell(3)).toBeGreaterThan(stageDwell(1));
  });
});

describe('manual issuance layout', () => {
  const stages = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => run([{ type: 'flowGo', stage: n }]));
  it('keeps the APP01 private key inside the APP01 zone at every stage and mid-transition', () => {
    stages.forEach((s, i) => {
      const f = computeFrame(s, VP, ctx);
      const z = flowZones(i, safeArea(s, VP)).app;
      const k = f.els['flow.key'];
      expect(k.x).toBeGreaterThanOrEqual(z.x);
      expect(k.x + k.w).toBeLessThanOrEqual(z.x + z.w);
      if (i > 0) {
        const prev = computeFrame(stages[i - 1], VP, ctx);
        const tr = makeTransition(settled(prev), f, { start: 0, duration: 1000 });
        for (const t of [250, 500, 750]) {
          const mid = sample(tr, t).els['flow.key'];
          const za = flowZones(i - 1, safeArea(s, VP)).app;
          expect(mid.x + mid.w).toBeLessThanOrEqual(Math.max(z.x + z.w, za.x + za.w) + 0.001);
        }
      }
    });
  });
  it('moves the CSR to the CA on submission and the certificate to APP01 on return', () => {
    const f0 = computeFrame(stages[0], VP, ctx), f1 = computeFrame(stages[1], VP, ctx), f4 = computeFrame(stages[4], VP, ctx);
    const z1 = flowZones(1, safeArea(stages[1], VP));
    expect(f0.els.csr.x).toBeLessThan(z1.lane.x);
    expect(f1.els.csr.x).toBeGreaterThanOrEqual(z1.ca.x);
    const z4 = flowZones(4, safeArea(stages[4], VP));
    expect(f4.els.cert.x).toBeLessThan(z4.app.x + z4.app.w);
  });
  it('builds a separate new certificate beside the CSR during issuance', () => {
    const f = computeFrame(stages[3], VP, ctx);
    expect(f.els['flow.newcert']).toBeTruthy();
    expect(f.els['flow.newcert'].x).toBeGreaterThan(f.els.csr.x);
    expect(f.els.csr.o).toBe(1);
    expect(f.els['flow.seal']).toBeTruthy();
  });
  it('places the installed certificate under the Personal store, and pairs it with the key', () => {
    const f = computeFrame(stages[6], VP, ctx);
    expect(f.els['flow.store']).toBeTruthy();
    expect(f.els.cert.y).toBeGreaterThan(f.els['flow.store'].y);
    expect(f.els['flow.pair'].o).toBe(1);
  });
  it('shows the offline Root CA muted, never as an active participant', () => {
    stages.forEach((s) => {
      const f = computeFrame(s, VP, ctx);
      expect(f.els['flow.root'].dim).toBeGreaterThan(0);
    });
  });
});

describe('captions', () => {
  it('exist for every step and flow stage', () => {
    for (let i = 0; i < 8; i++) expect(captionFor(goStep(initialState, i)).text.length).toBeGreaterThan(20);
    for (let i = 0; i < 8; i++) expect(captionFor(run([{ type: 'flowGo', stage: i }])).text.length).toBeGreaterThan(20);
    expect(captionFor(run([{ type: 'compare' }])).title).toMatch(/Compare/);
  });
});
