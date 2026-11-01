// Pure, time-driven interpolation between two layout frames.
// sample(transition, t) depends only on its arguments, so any frame can be
// reproduced exactly (interactive playback and film rendering share this code).

import { cubicBezier, clamp01, lerp } from './easing.js';
import { EASE } from './tokens.js';

export const DEFAULT_PROPS = Object.freeze({
  x: 0, y: 0, w: 0, h: 0, z: 0, // geometry (px)
  o: 0, // opacity
  k: 1, // content scale
  d: 0, // detail: 0 = assembled face, 1 = exploded / labelled
  s: 0, // selection emphasis
  dim: 0, // de-emphasis
  sp: 0, // spine (collapsed column) mode
  pv: 0, // provenance colouring
  r: 0, // reveal count for progressive lists
  op: 0, // open (composite unfolded)
  t: 0, // path trace progress
});

export const DEFAULT_CAMERA = Object.freeze({ rx: 0, ry: 0, tx: 0, ty: 0, s: 1 });

const easeCache = new Map();
function easeFn(name) {
  if (!easeCache.has(name)) easeCache.set(name, cubicBezier(...EASE[name]));
  return easeCache.get(name);
}

export function withDefaults(props) {
  return { ...DEFAULT_PROPS, ...props };
}

function lerpProps(a, b, p) {
  const out = {};
  for (const key in DEFAULT_PROPS) out[key] = lerp(a[key], b[key], p);
  return out;
}

/**
 * @param {Frame} from  settled or sampled frame the motion starts from
 * @param {Frame} to    target layout frame
 * @param {{start:number, duration:number, delays?:Record<string,number>, ease?:string}} opts
 */
export function makeTransition(from, to, opts) {
  const delays = opts.delays || {};
  const maxDelay = Object.values(delays).reduce((m, v) => Math.max(m, v), 0);
  return {
    from,
    to,
    start: opts.start,
    duration: Math.max(0, opts.duration),
    base: Math.max(0, opts.duration - maxDelay),
    delays,
    ease: opts.ease || 'hero',
  };
}

export function isSettled(tr, t) {
  return !tr || t >= tr.start + tr.duration;
}

/** Sample a transition at absolute time t (ms). */
export function sample(tr, t) {
  const { from, to } = tr;
  const local = t - tr.start;
  if (tr.duration === 0 || local >= tr.duration) return settle(to, from);
  const ease = easeFn(tr.ease);
  const support = easeFn('support');
  const els = {};
  const ids = new Set([...Object.keys(from.els), ...Object.keys(to.els)]);
  for (const id of ids) {
    const a0 = from.els[id];
    const b0 = to.els[id];
    const a = a0 ? withDefaults(a0) : withDefaults(to.enter?.[id] || { ...b0, o: 0 });
    const b = b0 ? withDefaults(b0) : withDefaults({ ...a0, ...(to.exit?.[id] || {}), o: 0 });
    const delay = tr.delays[id] || 0;
    const raw = tr.base === 0 ? 1 : clamp01((local - delay) / tr.base);
    const p = delay > 0 ? support(raw) : ease(raw);
    els[id] = lerpProps(a, b, p);
  }
  const cp = ease(clamp01(local / tr.duration));
  const ca = { ...DEFAULT_CAMERA, ...from.cam };
  const cb = { ...DEFAULT_CAMERA, ...to.cam };
  const cam = {};
  for (const k in DEFAULT_CAMERA) cam[k] = lerp(ca[k], cb[k], cp);
  return { cam, els, meta: to.meta };
}

/** Final frame: target elements, plus departed elements held invisible. */
function settle(to, from) {
  const els = {};
  for (const id in to.els) els[id] = withDefaults(to.els[id]);
  if (from) {
    for (const id in from.els) {
      if (!(id in els)) els[id] = withDefaults({ ...from.els[id], ...(to.exit?.[id] || {}), o: 0 });
    }
  }
  return { cam: { ...DEFAULT_CAMERA, ...to.cam }, els, meta: to.meta };
}

export function settled(frame) {
  return settle(frame, null);
}
