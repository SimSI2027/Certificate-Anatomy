// Pure application state machine. reduce(state, action, ctx) never mutates.
// ctx.index: Map of node id -> { children: [...ids], parentId } for both artifacts.

import { FLOW_STAGES } from '../scenario/issuance.js';

export const STEPS = Object.freeze([
  { id: 'signed', title: 'Signed certificate' },
  { id: 'certAnatomy', title: 'Certificate anatomy' },
  { id: 'trace', title: 'Trace to CSR' },
  { id: 'csrAnatomy', title: 'CSR anatomy' },
  { id: 'submission', title: 'Manual submission' },
  { id: 'issuance', title: 'CA evaluation and issuance' },
  { id: 'install', title: 'Return and installation' },
  { id: 'verify', title: 'Verification' },
]);

/** First flow stage of each flow step. */
const STEP_TO_STAGE = { 4: 0, 5: 2, 6: 4, 7: 7 };

export const ENCODINGS = Object.freeze(['structure', 'hex', 'base64', 'pem']);

export const initialState = Object.freeze({
  step: 0,
  scene: 'cert',
  cert: Object.freeze({ exploded: false, open: Object.freeze([]) }),
  csr: Object.freeze({ exploded: false, open: Object.freeze([]) }),
  encoding: 'structure',
  selected: null,
  traceFilter: null,
  flowStage: 0,
  playing: false,
  help: false,
});

export const artifactOf = (id) => (id.startsWith('csr') ? 'csr' : id.startsWith('cert') ? 'cert' : null);
const isRoot = (id) => id === 'cert' || id === 'csr';

function hasChildren(ctx, id) {
  const n = ctx.index.get(id);
  return Boolean(n && n.children && n.children.length);
}

/** Ancestors from the artifact root's child down to id (root excluded). */
function pathTo(ctx, id) {
  const path = [];
  let cur = id;
  while (cur && !isRoot(cur)) {
    path.unshift(cur);
    cur = ctx.index.get(cur)?.parentId;
  }
  return path;
}

const setArtifact = (state, kind, patch) => ({ ...state, [kind]: { ...state[kind], ...patch } });

export function isTraceMode(state) {
  return state.scene === 'cert' && state.step === 2;
}

export function goStep(state, step) {
  const s = Math.max(0, Math.min(STEPS.length - 1, step));
  const base = { ...state, step: s, selected: null, encoding: 'structure', help: false, traceFilter: null };
  switch (s) {
    case 0:
      return { ...base, scene: 'cert', playing: false, cert: { exploded: false, open: [] } };
    case 1:
      return {
        ...base, scene: 'cert', playing: false,
        cert: { exploded: true, open: state.scene === 'cert' && state.cert.exploded ? state.cert.open : [] },
      };
    case 2:
      return { ...base, scene: 'cert', playing: false, cert: { exploded: true, open: ['cert.tbs', 'cert.tbs.extensions'] } };
    case 3:
      return { ...base, scene: 'csr', playing: false, csr: { exploded: false, open: [] } };
    default:
      return { ...base, scene: 'flow', flowStage: STEP_TO_STAGE[s] };
  }
}

function flowGo(state, stage) {
  const st = Math.max(0, Math.min(FLOW_STAGES.length - 1, stage));
  return {
    ...state,
    scene: 'flow',
    flowStage: st,
    step: FLOW_STAGES[st].step,
    selected: null,
    playing: st === FLOW_STAGES.length - 1 ? false : state.playing,
  };
}

function activate(state, id, ctx) {
  const kind = artifactOf(id);
  if (state.scene === 'compare') {
    return { ...state, selected: state.selected === id ? null : id };
  }
  if (!kind || kind !== state.scene) return state;
  const art = state[kind];

  if (isRoot(id)) {
    // Clicking the artifact toggles exploded <-> assembled.
    if (!art.exploded) {
      const next = setArtifact({ ...state, selected: null }, kind, { exploded: true, open: [] });
      return kind === 'cert' && state.step === 0 ? { ...next, step: 1 } : next;
    }
    const next = setArtifact({ ...state, selected: null, encoding: 'structure' }, kind, { exploded: false, open: [] });
    return kind === 'cert' ? { ...next, step: 0 } : next;
  }

  if (!art.exploded) return state;

  if (hasChildren(ctx, id)) {
    const path = pathTo(ctx, id);
    const isOpen = art.open[path.length - 1] === id;
    if (isOpen && art.open.length > path.length) {
      // Clicking an open ancestor (or its spine) folds everything deeper.
      return setArtifact({ ...state, selected: id }, kind, { open: art.open.slice(0, path.length) });
    }
    if (isOpen) {
      return setArtifact({ ...state, selected: state.selected === id ? null : id }, kind, { open: path.slice(0, -1) });
    }
    return setArtifact({ ...state, selected: id }, kind, { open: path });
  }

  // A plain field: select it (or close it when clicked again).
  return { ...state, selected: state.selected === id ? null : id };
}

/** Escape moves exactly one level up. */
export function escape(state) {
  if (state.help) return { ...state, help: false };
  if (state.selected) return { ...state, selected: null };
  if (state.encoding !== 'structure') return { ...state, encoding: 'structure' };
  if (state.scene === 'cert' || state.scene === 'csr') {
    const art = state[state.scene];
    if (art.open.length) return setArtifact(state, state.scene, { open: art.open.slice(0, -1) });
    if (art.exploded) {
      const next = setArtifact(state, state.scene, { exploded: false, open: [] });
      return state.scene === 'cert' ? { ...next, step: 0 } : next;
    }
    if (state.scene === 'csr') return goStep(state, 0); // exit focused mode
    return state;
  }
  if (state.scene === 'compare') return goStep(state, 2);
  if (state.scene === 'flow' && state.playing) return { ...state, playing: false };
  return state;
}

export function reduce(state, action, ctx) {
  switch (action.type) {
    case 'goStep':
      return goStep(state, action.step);
    case 'activate':
      return activate(state, action.id, ctx);
    case 'select':
      return { ...state, selected: action.id };
    case 'escape':
    case 'background':
      return escape(state);
    case 'setEncoding':
      if (state.scene !== 'cert' && state.scene !== 'csr') return state;
      return setArtifact({ ...state, encoding: action.mode, selected: action.mode === 'structure' ? state.selected : null },
        state.scene, { exploded: true });
    case 'traceFilter':
      return { ...state, traceFilter: state.traceFilter === action.category ? null : action.category };
    case 'compare':
      return { ...state, scene: 'compare', selected: action.id || null, playing: false, encoding: 'structure', help: false };
    case 'flowGo':
      return flowGo(state, action.stage);
    case 'flowRestart':
      return { ...flowGo(state, 0), playing: true };
    case 'play':
      if (state.scene !== 'flow') return { ...flowGo(state, 0), playing: true };
      if (state.flowStage === FLOW_STAGES.length - 1) return { ...flowGo(state, 0), playing: true };
      return { ...state, playing: true };
    case 'pause':
      return { ...state, playing: false };
    case 'next':
      if (state.scene === 'flow') {
        if (state.flowStage === FLOW_STAGES.length - 1) return state;
        return flowGo(state, state.flowStage + 1);
      }
      if (state.scene === 'compare') return goStep(state, 3);
      return goStep(state, state.step + 1);
    case 'prev':
      if (state.scene === 'flow') {
        if (state.flowStage === 0) return { ...goStep(state, 3), csr: { exploded: true, open: [] } };
        return flowGo({ ...state, playing: false }, state.flowStage - 1);
      }
      if (state.scene === 'compare') return goStep(state, 2);
      return goStep(state, state.step - 1);
    case 'help':
      return { ...state, help: !state.help };
    default:
      return state;
  }
}
