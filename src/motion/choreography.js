// Chooses the motion for a state change. One hero motion per change.

import { DURATION, HOLD, REDUCED } from './tokens.js';

export function changeKind(prev, next) {
  if (prev.scene !== next.scene) return 'scene';
  if (next.scene === 'flow') return prev.flowStage !== next.flowStage ? 'flowStage' : 'select';
  if (next.scene === 'cert' || next.scene === 'csr') {
    const a = prev[next.scene], b = next[next.scene];
    if (prev.encoding !== next.encoding) return 'encoding';
    if (!a.exploded && b.exploded) return 'explode';
    if (a.exploded && !b.exploded) return 'collapse';
    if (b.open.length > a.open.length || b.open.some((id, i) => a.open[i] !== id)) {
      return b.open.length >= a.open.length ? 'unfold' : 'fold';
    }
    if (a.open.length > b.open.length) return 'fold';
    if (prev.step !== next.step) return 'trace';
    if (prev.traceFilter !== next.traceFilter) return 'select';
  }
  if (prev.selected !== next.selected) return 'select';
  return 'none';
}

const LONG_STAGES = new Set([2, 3, 7]);

export function durationFor(prev, next, { reduced = false } = {}) {
  if (reduced) return Math.round(DURATION.select * REDUCED.durationScale);
  const kind = changeKind(prev, next);
  switch (kind) {
    case 'scene': return DURATION.scene;
    case 'explode': return DURATION.explode;
    case 'collapse': return DURATION.collapse;
    case 'unfold': return DURATION.unfold;
    case 'fold': return DURATION.fold;
    case 'encoding': return DURATION.encoding;
    case 'trace': return DURATION.trace;
    case 'flowStage': return LONG_STAGES.has(next.flowStage) ? DURATION.flowStageLong : DURATION.flowStage;
    case 'select': return DURATION.select;
    default: return DURATION.select;
  }
}

/** How long autoplay waits on a stage (motion plus reading hold). */
export function stageDwell(stage, reduced = false) {
  const long = LONG_STAGES.has(stage);
  const motion = reduced ? 0 : long ? DURATION.flowStageLong : DURATION.flowStage;
  return motion + (long ? HOLD.flowStageLong : HOLD.flowStage);
}
