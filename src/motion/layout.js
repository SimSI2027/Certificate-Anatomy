// Pure layout: (state, viewport, ctx) -> target frame.
// Because every layout is computed from state alone (never accumulated from a
// previous frame), the assembled position after explode -> reassemble is
// exactly the assembled position before it.

import { CAMERA, LAYER_STEP } from './tokens.js';
import { isTraceMode } from '../state/machine.js';
import { RELATIONSHIPS } from '../anatomy/relationships.js';
import { CERTIFICATE_FIELDS } from '../anatomy/certificate-fields.js';
import { FLOW_STAGES } from '../scenario/issuance.js';

export const BLOCK = Object.freeze({ w: 520, h: 320 });
const COL = Object.freeze({ min: 232, max: 330, spine: 46, gap: 30 });
const KEY = Object.freeze({ w: 250, h: 104 });

export function safeArea(state, vp) {
  const mobile = vp.w < 760;
  const side = mobile ? 16 : 40;
  const legend = isTraceMode(state) ? (mobile ? 64 : 40) : 0;
  const top = (mobile ? 92 : 88) + legend;
  const bottom = mobile ? 290 : 150;
  const inspectorScenes = state.scene === 'cert' || state.scene === 'csr' || state.scene === 'compare';
  const hasInspector = Boolean(state.selected) && inspectorScenes && !vp.film;
  const insp = hasInspector && !mobile ? Math.min(430, Math.round(vp.w * 0.31)) : 0;
  const sheet = hasInspector && mobile ? Math.round(vp.h * 0.46) : 0;
  return {
    x: side,
    y: top,
    w: Math.max(200, vp.w - side * 2 - insp - (insp ? 16 : 0)),
    h: Math.max(220, vp.h - top - bottom - sheet + (sheet ? bottom - 24 : 0)),
    mobile,
    inspector: insp,
    sheet,
  };
}

const rect = (x, y, w, h, extra = {}) => ({ x, y, w, h, o: 1, ...extra });
const centerY = (r) => r.y + r.h / 2;

function childrenOf(ctx, id) {
  const n = ctx.index.get(id);
  return n ? n.children.map((c) => (typeof c === 'string' ? c : c.id)) : [];
}

/** Every node id under an artifact root (root excluded), depth-first. */
function descendants(ctx, id, out = []) {
  for (const c of childrenOf(ctx, id)) {
    out.push(c);
    descendants(ctx, c, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Artifact scenes (certificate, CSR)
// ---------------------------------------------------------------------------

function assembledBlock(kind, area) {
  const withKey = kind === 'csr';
  const sideBySide = withKey && !area.mobile;
  const groupW = sideBySide ? BLOCK.w + 56 + KEY.w : BLOCK.w;
  const groupH = withKey && !sideBySide ? BLOCK.h + 40 + KEY.h : BLOCK.h;
  const k = Math.min(1, (area.w - 8) / groupW, (area.h - 16) / (groupH + 24));
  const gx = area.x + (area.w - groupW * k) / 2;
  const gy = area.y + (area.h - groupH * k) / 2 - 6;
  const block = { x: sideBySide ? gx + (KEY.w + 56) * k : gx, y: gy, k };
  const key = withKey
    ? sideBySide
      ? { x: gx, y: gy + (BLOCK.h - KEY.h) * k * 0.5, w: KEY.w, h: KEY.h, k }
      : { x: gx, y: gy + (BLOCK.h + 40) * k, w: KEY.w, h: KEY.h, k }
    : null;
  return { block, key };
}

function layoutAssembled(kind, ctx, area, els) {
  const { block, key } = assembledBlock(kind, area);
  const { x, y, k } = block;
  const bw = BLOCK.w * k;
  const bh = BLOCK.h * k;
  els[kind] = { x, y, w: BLOCK.w, h: BLOCK.h, k, o: 1, d: 0, z: 0 };
  const top = childrenOf(ctx, kind);
  top.forEach((id, i) => {
    els[id] = { x, y: y + (i + 1) * LAYER_STEP.y * k, w: bw, h: bh, z: (i + 1) * LAYER_STEP.z, o: 1, d: 0 };
    for (const dsc of descendants(ctx, id)) {
      els[dsc] = { x: x + bw * 0.1, y: y + bh * 0.3, w: bw * 0.8, h: 40 * k, z: (i + 1) * LAYER_STEP.z - 6, o: 0 };
    }
  });
  if (kind === 'cert') els['cert.thumbprint'] = { x: x + bw * 0.1, y: y + bh * 0.6, w: bw * 0.8, h: 52, z: -40, o: 0 };
  if (key) els['csr.privateKey'] = { ...key, o: 1, d: 0 };
  return { block, key };
}

/** Choose how many leading columns collapse to spines so the rest fit. */
export function columnPlan(n, width) {
  for (let spines = 0; spines < n; spines++) {
    const full = n - spines;
    const need = spines * COL.spine + full * COL.min + (n - 1) * COL.gap;
    if (need <= width || spines === n - 1) {
      const colW = Math.max(150, Math.min(COL.max, (width - spines * COL.spine - (n - 1) * COL.gap) / full));
      return { spines, colW };
    }
  }
  return { spines: n - 1, colW: COL.min };
}

function col0Heights(kind, availH) {
  const header = 46;
  const alg = 64;
  const sig = 98;
  const thumb = kind === 'cert' ? 62 : 0;
  const count = kind === 'cert' ? 5 : 4;
  const gaps = (count - 1) * 10;
  const big = Math.max(108, Math.min(236, availH - header - alg - sig - thumb - gaps));
  return { header, big, alg, sig, thumb, gaps };
}

function layoutExploded(kind, state, ctx, area, els) {
  const art = state[kind];
  const open = art.open;
  const shelf = kind === 'csr' ? (area.mobile ? 0 : KEY.h + 22) : 0;
  const colArea = { ...area, h: area.h - shelf };
  const n = 1 + open.length;
  const { spines, colW } = columnPlan(n, colArea.w);
  const widths = Array.from({ length: n }, (_, i) => (i < spines ? COL.spine : colW));
  const total = widths.reduce((a, b) => a + b, 0) + (n - 1) * COL.gap;
  let cx = colArea.x + Math.max(0, (colArea.w - total) / 2);
  const xs = widths.map((w) => {
    const x = cx;
    cx += w + COL.gap;
    return x;
  });

  const visible = new Set();
  const top = childrenOf(ctx, kind);

  // Column 0: the artifact header plus its top-level structures.
  if (spines > 0) {
    const sid = open[0];
    els[sid] = rect(xs[0], colArea.y, COL.spine, colArea.h, { sp: 1, d: 1, op: 1 });
    visible.add(sid);
    els[kind] = { x: xs[0], y: colArea.y, w: COL.spine, h: 46, k: 1, o: 0, d: 1 };
    for (const id of top) if (id !== sid) els[id] = rect(xs[0], centerY(els[sid]) - 20, COL.spine, 40, { o: 0, d: 1 });
    if (kind === 'cert') els['cert.thumbprint'] = rect(xs[0], colArea.y + colArea.h - 40, COL.spine, 40, { o: 0, d: 1 });
  } else {
    const H = col0Heights(kind, colArea.h);
    const items = [['__root', H.header], ...top.map((id, i) => [id, i === 0 ? H.big : i === 1 ? H.alg : H.sig])];
    if (kind === 'cert') items.push(['cert.thumbprint', H.thumb]);
    const colH = items.reduce((a, [, h]) => a + h, 0) + (items.length - 1) * 10;
    let y = colArea.y + Math.max(0, (colArea.h - colH) / 2);
    for (const [id, h] of items) {
      if (id === '__root') els[kind] = { x: xs[0], y, w: colW, h, k: 1, o: 1, d: 1 };
      else {
        els[id] = rect(xs[0], y, colW, h, { d: 1, op: open[0] === id ? 1 : 0 });
        visible.add(id);
      }
      y += h + 10;
    }
  }

  // Deeper columns.
  for (let j = 1; j < n; j++) {
    const parent = open[j - 1];
    const kids = childrenOf(ctx, parent);
    const pr = els[parent];
    if (j < spines) {
      const sid = open[j];
      els[sid] = rect(xs[j], colArea.y, COL.spine, colArea.h, { sp: 1, d: 1, op: 1 });
      visible.add(sid);
      for (const id of kids) if (id !== sid) els[id] = rect(xs[j], centerY(els[sid]) - 20, COL.spine, 40, { o: 0, d: 1 });
      continue;
    }
    const m = kids.length;
    const gap = 8;
    const itemH = Math.max(34, Math.min(62, (colArea.h - (m - 1) * gap) / m));
    const colH = m * itemH + (m - 1) * gap;
    const want = centerY(pr) - colH / 2;
    let y = Math.max(colArea.y, Math.min(colArea.y + colArea.h - colH, want));
    if (colH > colArea.h) y = colArea.y;
    for (const id of kids) {
      els[id] = rect(xs[j], y, colW, itemH, { d: 1, op: open[j] === id ? 1 : 0 });
      visible.add(id);
      y += itemH + gap;
    }
  }

  // Everything else folds into its nearest visible ancestor, invisible.
  for (const id of descendants(ctx, kind)) {
    if (visible.has(id) || els[id]) continue;
    let anc = ctx.index.get(id)?.parentId;
    while (anc && !els[anc]) anc = ctx.index.get(anc)?.parentId;
    const a = els[anc] || els[kind];
    els[id] = rect(a.x + 8, a.y + Math.min(a.h - 34, 40), Math.max(40, a.w - 16), 34, { o: 0, d: 1, z: -30 });
  }

  if (kind === 'csr') {
    const ky = area.mobile ? colArea.y + colArea.h - KEY.h : area.y + area.h - KEY.h;
    els['csr.privateKey'] = rect(area.x, ky, Math.min(KEY.w + 40, area.w), KEY.h, { d: 1, k: 1 });
    if (area.mobile) els['csr.privateKey'].o = 0;
    // The pairing line is drawn while the public key structure is in view.
    const target = els['csr.cri.spki.publicKey']?.o ? 'csr.cri.spki.publicKey' : els['csr.cri.spki']?.o ? 'csr.cri.spki' : null;
    if (target && !area.mobile) els['link.keypair'] = { o: 1, t: 1, x: 0, y: 0, w: 0, h: 0, r: target === 'csr.cri.spki' ? 0 : 1 };
  }
  return { xs, widths, spines };
}

function layoutEncoding(kind, state, ctx, area, els) {
  layoutAssembled(kind, ctx, area, els);
  // The structured artifact steps back; the encoded bytes take the stage.
  for (const id of Object.keys(els)) {
    if (id === 'csr.privateKey') continue;
    els[id] = { ...els[id], o: 0 };
  }
  const blk = els[kind];
  els[kind] = { ...blk, o: 0.0 };
  const w = Math.min(area.w, 900);
  const enter = { x: blk.x, y: blk.y, w: BLOCK.w * blk.k, h: BLOCK.h * blk.k, o: 0 };
  const id = `enc.${kind}.${state.encoding}`;
  els[id] = rect(area.x + (area.w - w) / 2, area.y, w, area.h, { d: 1 });
  if (kind === 'csr') els['csr.privateKey'] = { ...els['csr.privateKey'], o: area.mobile ? 0 : 0.0 };
  return { enter: { [id]: enter } };
}

// ---------------------------------------------------------------------------
// Compare scene
// ---------------------------------------------------------------------------

export const COMPARE_ROWS = Object.freeze({
  cert: [
    'cert.tbs.subject', 'cert.tbs.spki', 'cert.ext.san', 'cert.ext.ku', 'cert.ext.eku',
    'cert.tbs.serial', 'cert.tbs.issuer', 'cert.tbs.validity', 'cert.ext.bc', 'cert.ext.ski',
    'cert.ext.aki', 'cert.ext.aia', 'cert.ext.cdp', 'cert.sigValue',
  ],
  // CSR rows: index into the certificate row it aligns with.
  csr: [
    ['csr.cri.subject', 0], ['csr.cri.spki', 1], ['csr.ext.san', 2], ['csr.ext.ku', 3], ['csr.ext.eku', 4],
    ['csr.attr.template', 6], ['csr.sigValue', 8],
  ],
});

function layoutCompare(state, ctx, area, els) {
  const rows = COMPARE_ROWS.cert.length;
  const headH = 40;
  const sepH = 18; // extra gap between "came from the CSR" and "CA only" groups
  const gap = 6;
  const rowH = Math.max(28, Math.min(48, (area.h - headH - sepH - (rows - 1) * gap) / rows));
  const pathGap = area.mobile ? 36 : Math.max(120, Math.min(260, area.w * 0.22));
  const colW = Math.min(360, (area.w - pathGap) / 2);
  const total = colW * 2 + pathGap;
  const x0 = area.x + (area.w - total) / 2;
  const x1 = x0 + colW + pathGap;
  const contentH = headH + rows * rowH + (rows - 1) * gap + sepH;
  const y0 = area.y + Math.max(0, (area.h - contentH) / 2);
  const rowY = (i) => y0 + headH + i * (rowH + gap) + (i >= 5 ? sepH : 0);

  els['cmp.head.csr'] = rect(x0, y0, colW, headH - 8, { d: 1 });
  els['cmp.head.cert'] = rect(x1, y0, colW, headH - 8, { d: 1 });

  const sel = state.selected;
  const rel = sel ? RELATIONSHIPS.find((r) => r.csr === sel || r.cert === sel) : null;
  const related = new Set(rel ? [rel.csr, rel.cert].filter(Boolean) : []);
  const dimOf = (id) => (rel && !related.has(id) ? 0.62 : 0);

  COMPARE_ROWS.cert.forEach((id, i) => {
    const cat = CERTIFICATE_FIELDS[id]?.category;
    els[id] = rect(x1, rowY(i), colW, rowH, { d: 1, pv: 1, s: sel === id ? 1 : 0, dim: dimOf(id), op: 0, sp: 0, r: cat ? 1 : 0 });
  });
  for (const [id, row] of COMPARE_ROWS.csr) {
    els[id] = rect(x0, rowY(row), colW, rowH, { d: 1, pv: 1, s: sel === id ? 1 : 0, dim: dimOf(id) });
  }
  for (const r of RELATIONSHIPS) {
    const active = rel && rel.id === r.id;
    els[`rel.${r.id}`] = { x: 0, y: 0, w: 0, h: 0, o: 1, t: 1, s: active ? 1 : 0, dim: rel && !active ? 0.75 : 0 };
  }
  return { pathGap, x0, x1, colW };
}

// ---------------------------------------------------------------------------
// Manual issuance flow
// ---------------------------------------------------------------------------

const ZONE_SPLITS = [
  [0.44, 0.18], // created: APP01 has the focus
  [0.27, 0.15], // submitted
  [0.27, 0.13], // evaluated
  [0.27, 0.13], // issued
  [0.56, 0.14], // returned: focus returns to APP01
  [0.58, 0.12],
  [0.58, 0.12],
  [0.6, 0.1], // verified
];

export const FLOW_TOKENS = Object.freeze([
  { id: 'subject', label: 'Subject', from: 'csr', category: 'approved' },
  { id: 'spki', label: 'Public key', from: 'csr', category: 'approved' },
  { id: 'san', label: 'SAN', from: 'csr', category: 'approved' },
  { id: 'ku', label: 'Key Usage', from: 'csr', category: 'approved' },
  { id: 'eku', label: 'EKU', from: 'csr', category: 'approved' },
  { id: 'serial', label: 'Serial number', from: 'ca', category: 'added' },
  { id: 'issuer', label: 'Issuer', from: 'ca', category: 'added' },
  { id: 'validity', label: 'Validity', from: 'ca', category: 'added' },
  { id: 'bc', label: 'Basic Constraints', from: 'ca', category: 'added' },
  { id: 'keyids', label: 'SKI / AKI', from: 'ca', category: 'derived' },
  { id: 'aia', label: 'AIA', from: 'ca', category: 'config' },
  { id: 'cdp', label: 'CDP', from: 'ca', category: 'config' },
]);

export function flowZones(stage, area) {
  const [a, l] = ZONE_SPLITS[stage];
  if (area.mobile) {
    // Stacked zones on narrow screens: APP01, then the hand-carried lane, then the CA.
    const ah = area.h * (a + 0.08);
    const lh = area.h * 0.1;
    return {
      app: { x: area.x, y: area.y, w: area.w, h: ah },
      lane: { x: area.x, y: area.y + ah, w: area.w, h: lh },
      ca: { x: area.x, y: area.y + ah + lh, w: area.w, h: area.h - ah - lh },
      vertical: true,
    };
  }
  const aw = area.w * a;
  const lw = area.w * l;
  return {
    app: { x: area.x, y: area.y, w: aw, h: area.h },
    lane: { x: area.x + aw, y: area.y, w: lw, h: area.h },
    ca: { x: area.x + aw + lw, y: area.y, w: area.w - aw - lw, h: area.h },
    vertical: false,
  };
}

function layoutFlowMobile(state, area, els) {
  const st = state.flowStage;
  const atCa = st >= 1 && st <= 3;
  const x = area.x, w = area.w;
  let y = area.y;
  const put = (id, h, extra = {}) => { els[id] = rect(x, y, w, h, { d: 1, ...extra }); y += h + 10; return els[id]; };
  put(atCa ? 'flow.zone.ca' : 'flow.zone.app', 40, { s: 1 });
  const k = Math.min(0.5, (w * 0.62) / BLOCK.w);
  const block = (id, extra = {}) => {
    els[id] = { x, y, w: BLOCK.w, h: BLOCK.h, k, o: 1, d: 0, ...extra };
    y += BLOCK.h * k + 10;
  };
  if (!atCa) put('flow.key', 64);
  if (st === 0) block('csr');
  if (st === 1) { put('flow.reqrec', 74, { r: 0 }); block('csr'); }
  if (st === 2) { put('flow.reqrec', 74, { r: 1 }); put('flow.eval', Math.max(160, area.y + area.h - y), { r: 9 }); }
  if (st === 3) {
    els.csr = { x, y: area.y, w: BLOCK.w, h: BLOCK.h, k: 0.2, o: 0, d: 0 };
    const tokH = 15, top = 46;
    const nc = put('flow.newcert', top + FLOW_TOKENS.length * (tokH + 2) + 40);
    FLOW_TOKENS.forEach((t, i) => (els[`flow.tok.${t.id}`] = rect(x + 8, nc.y + top + i * (tokH + 2), w - 16, tokH, { d: 1 })));
    els['flow.seal'] = rect(x + 8, nc.y + nc.h - 34, w - 16, 28, { d: 1 });
  }
  if (st === 4) block('cert');
  if (st === 5) { put('flow.store', 48); block('cert'); }
  if (st === 6) { put('flow.match', 150); block('cert'); }
  if (st === 7) { put('flow.verify', Math.max(140, area.y + area.h - y - 54), { r: 12 }); put('flow.done', 44); }
  const stage = FLOW_STAGES[st];
  if (stage.command && st !== 7 && y + 70 <= area.y + area.h + 20) put(`flow.cmd.${stage.id}`, 70);
  const enter = {};
  if (els['flow.eval']) enter['flow.eval'] = { ...els['flow.eval'], o: 0, r: 0 };
  if (els['flow.verify']) enter['flow.verify'] = { ...els['flow.verify'], o: 0, r: 0 };
  return { zones: null, enter };
}

function layoutFlow(state, ctx, area, els) {
  if (area.mobile) return layoutFlowMobile(state, area, els);
  const st = state.flowStage;
  const Z = flowZones(st, area);
  const V = Z.vertical;
  const head = V ? 34 : 64;
  const pad = V ? 8 : 18;

  for (const z of ['app', 'lane', 'ca']) {
    const r = Z[z];
    const active = FLOW_STAGES[st].participants.includes(z === 'lane' ? 'administrator' : z);
    els[`flow.zone.${z}`] = rect(r.x, r.y, r.w, V ? head : r.h, { d: 1, s: active ? 1 : 0 });
  }
  const app = Z.app, ca = Z.ca, lane = Z.lane;
  const inner = (r, first) => ({
    x: r.x + (first ? 0 : pad), y: r.y + head, w: r.w - pad * (first ? 1 : 2), h: r.h - head - (V ? 4 : pad),
  });
  const A = inner(app, true), C = inner(ca, false);

  // Once the certificate returns, APP01 splits into a left column (key, then
  // evidence) and a right column (certificate store, certificate, commands).
  const leftW = st >= 4 ? Math.min(400, A.w * 0.46) : Math.min(340, A.w);
  const rightX = A.x + leftW + 28;
  const rightW = A.x + A.w - rightX;

  // APP01 private key: always in the APP01 zone, never on a route.
  const keyH = V ? 60 : 100;
  const key = rect(A.x, A.y + 8, Math.min(300, leftW), keyH, { d: 1 });
  els['flow.key'] = key;

  // CSR block (the same element as the CSR artifact), smaller in the flow.
  const csrK = V ? 0.3 : st >= 4 ? 0.36 : 0.5;
  const csrW = BLOCK.w * csrK, csrH = BLOCK.h * csrK;
  const csrAtApp = { x: V ? A.x + A.w - csrW : A.x, y: V ? A.y + 8 : key.y + keyH + 26 };
  const csrAtCa = { x: C.x, y: C.y + (V ? 30 : 92) };
  const csr = st === 0 ? csrAtApp : csrAtCa;
  els.csr = { x: csr.x, y: csr.y, w: BLOCK.w, h: BLOCK.h, k: csrK, o: 1, d: 0, dim: st >= 3 ? 0.55 : 0 };

  // Pending request in Certificate Enrollment Requests until certreq -accept.
  if (!V) {
    els['flow.pending'] = rect(A.x, key.y + keyH + 26 + BLOCK.h * 0.5 + 18, Math.min(leftW, 360), 76, { d: 1, o: st <= 4 ? 1 : 0 });
  }

  // Request record in the CA database.
  if (st >= 1) {
    els['flow.reqrec'] = rect(C.x, C.y, Math.min(C.w, 380), V ? 26 : 74, { d: 1, r: st === 1 ? 0 : st === 2 ? 1 : 2 });
  }

  // Bottom of the CA zone: the Issuing CA key (in use) and the offline Root (not in use).
  // While the CA is busy (stages 1-3) its key sits under the CSR, so the signature
  // visibly travels from the CA key to the new certificate; the offline Root sits
  // apart, top right. Once the certificate leaves, both stack in the narrow CA zone.
  const busy = st < 4;
  const caKeyW = busy ? Math.min(260, csrW) : Math.min(300, C.w);
  const caKeyH = 84;
  const caKey = busy
    ? rect(C.x, C.y + C.h - caKeyH, caKeyW, caKeyH, { d: 1, o: st >= 1 ? 1 : 0, s: st === 3 ? 1 : 0 })
    : rect(C.x + C.w - caKeyW, C.y + C.h - caKeyH, caKeyW, caKeyH, { d: 1, s: 0 });
  els['flow.cakey'] = caKey;
  const rootW = busy ? Math.min(260, Math.max(180, C.w - 400)) : Math.min(300, C.w);
  const rootX = C.x + C.w - rootW;
  const rootY = busy ? C.y : caKey.y - 86;
  els['flow.root'] = rect(rootX, rootY, rootW, 76, { d: 1, dim: 0.35 });

  // Evaluation checklist, then the NEW certificate in the same place.
  const sideX = C.x + csrW + 24;
  const sideW = Math.max(160, Math.min(440, C.x + C.w - sideX));
  const sideY = C.y + (V ? 0 : 92);
  if (st === 2) els['flow.eval'] = rect(sideX, sideY, sideW, Math.min(C.h - 200, 310), { d: 1, r: 9 });
  else if (st === 3) els['flow.eval'] = rect(sideX, sideY, sideW, Math.min(C.h - 200, 310), { d: 1, r: 9, o: 0 });

  const ncW = Math.min(300, sideW);
  const tokTop = 78;
  const tokGap = 3;
  const tokRoom = C.y + C.h - sideY - tokTop - 46;
  const tokH = V ? 14 : Math.max(14, Math.min(20, tokRoom / FLOW_TOKENS.length - tokGap));
  const ncH = tokTop + FLOW_TOKENS.length * (tokH + tokGap) + 46;
  const csrBlock = { x: csr.x, y: csr.y, w: csrW, h: csrH };
  if (st === 3) {
    els['flow.newcert'] = rect(sideX, sideY, ncW, ncH, { d: 1 });
    FLOW_TOKENS.forEach((t, i) => {
      els[`flow.tok.${t.id}`] = rect(sideX + 10, sideY + tokTop + i * (tokH + tokGap), ncW - 20, tokH, { d: 1 });
    });
    els['flow.seal'] = rect(sideX + 10, sideY + ncH - 40, ncW - 20, 32, { d: 1 });
  } else if (st === 2) {
    // Tokens wait, invisible, at their sources so stage 3 shows where each value came from.
    FLOW_TOKENS.forEach((t, i) => {
      const from = t.from === 'csr'
        ? { x: csrBlock.x + 12, y: csrBlock.y + 24 + i * 20 }
        : { x: caKey.x, y: caKey.y - 6 - (i - 5) * 3 };
      els[`flow.tok.${t.id}`] = rect(from.x, from.y, Math.min(ncW - 20, 220), tokH, { d: 1, o: 0 });
    });
    els['flow.seal'] = rect(caKey.x, caKey.y, Math.min(caKeyW, ncW - 20), 32, { d: 1, o: 0 });
  }

  // The issued certificate (the same element as the certificate artifact).
  const certK = V ? 0.3 : 0.5;
  const ch = BLOCK.h * certK;
  let enterCert = null;
  if (st >= 4) {
    const sx = V ? A.x : rightX;
    const sw = V ? A.w : Math.min(460, rightW);
    const storeY = V ? A.y + keyH + 16 : A.y + 8;
    const storeH = V ? 30 : 48;
    if (st >= 5) els['flow.store'] = rect(sx, storeY, sw, storeH, { d: 1 });
    const cy = st >= 5 ? storeY + storeH + 12 : storeY;
    els.cert = { x: sx, y: cy, w: BLOCK.w, h: BLOCK.h, k: certK, o: 1, d: 0 };
    enterCert = { x: sideX, y: sideY, w: BLOCK.w, h: BLOCK.h, k: ncW / BLOCK.w, o: 0, d: 0 };
    if (st >= 6) els['flow.pair'] = { x: 0, y: 0, w: 0, h: 0, o: 1, t: 1 };
    const evY = key.y + keyH + 26;
    if (st === 6) els['flow.match'] = rect(A.x, evY, leftW, V ? 60 : 168, { d: 1 });
    if (st >= 7) {
      els['flow.verify'] = rect(A.x, V ? cy + ch + 8 : evY, V ? A.w : leftW, V ? 150 : Math.min(330, A.y + A.h - evY), { d: 1, r: 12 });
      els['flow.done'] = rect(V ? A.x : sx, V ? A.y + A.h - 36 : cy + ch + 22, Math.min(360, V ? A.w : sw), 44, { d: 1 });
    }
  }

  // Learning commands: shown, never executed.
  const stage = FLOW_STAGES[st];
  if (stage.command) {
    const onApp = stage.command.host === 'APP01';
    const ch2 = V ? 56 : 86;
    let x, w;
    if (V) { x = area.x; w = area.w; }
    else if (onApp && st >= 4) { x = rightX; w = Math.min(560, rightW); }
    else if (onApp) { x = A.x; w = Math.min(560, A.w); }
    else {
      w = Math.min(560, Math.max(380, lane.w + 160));
      x = Math.min(area.x + area.w - w, Math.max(area.x, lane.x + lane.w / 2 - w / 2));
    }
    const y = V ? lane.y + 4 : area.y + area.h - ch2;
    els[`flow.cmd.${stage.id}`] = rect(x, y, w, ch2, { d: 1 });
  }
  if (!V && (st === 1 || st === 4)) {
    els[st === 1 ? 'flow.carry' : 'flow.carry.back'] = rect(lane.x + 6, area.y + area.h * 0.36, Math.max(80, lane.w - 12), 64, { d: 1 });
  }

  // Checklists reveal item by item as they arrive.
  const enter = enterCert ? { cert: enterCert } : {};
  if (els['flow.eval'] && st === 2) enter['flow.eval'] = { ...els['flow.eval'], o: 0, r: 0 };
  if (els['flow.verify']) enter['flow.verify'] = { ...els['flow.verify'], o: 0, r: 0 };
  return { zones: Z, enter };
}

// ---------------------------------------------------------------------------

/**
 * @returns {{cam: object, els: Record<string, object>, enter?: object, meta: object}}
 */
export function computeFrame(state, vp, ctx) {
  const area = safeArea(state, vp);
  const els = {};
  let cam = { rx: 0, ry: 0, tx: 0, ty: 0, s: 1 };
  let enter = {};
  let info = {};

  if (state.scene === 'cert' || state.scene === 'csr') {
    const kind = state.scene;
    const art = state[kind];
    if (state.encoding !== 'structure') {
      info = layoutEncoding(kind, state, ctx, area, els);
      enter = info.enter;
    } else if (!art.exploded) {
      info = layoutAssembled(kind, ctx, area, els);
      cam = { ...cam, ...CAMERA.assembledTilt };
    } else {
      info = layoutExploded(kind, state, ctx, area, els);
      const trace = isTraceMode(state);
      for (const id of Object.keys(els)) {
        if (id === kind || id.startsWith('link.')) continue;
        const e = els[id];
        if (state.selected === id) e.s = 1;
        if (trace) {
          e.pv = 1;
          if (state.traceFilter) e.dim = traceMatches(id, state.traceFilter) ? 0 : 0.7;
        }
      }
    }
  } else if (state.scene === 'compare') {
    info = layoutCompare(state, ctx, area, els);
  } else if (state.scene === 'flow') {
    info = layoutFlow(state, ctx, area, els);
    enter = info.enter;
  }

  return { cam, els, enter, meta: { area, scene: state.scene, info } };
}

export function traceMatches(id, filter) {
  const def = CERTIFICATE_FIELDS[id];
  if (!def) return false;
  if (filter === 'validation') return Boolean(def.validation) && !def.computed && id !== 'cert.tbs' && id !== 'cert.tbs.extensions';
  return def.category === filter;
}

/** Stagger delays for a transition between two states (supporting motion later). */
export function staggerFor(prev, next, ctx, frameTo, tokens) {
  const delays = {};
  const { STAGGER } = tokens;
  if ((next.scene === 'cert' || next.scene === 'csr') && prev.scene === next.scene) {
    const kind = next.scene;
    const a = prev[kind], b = next[kind];
    if (!a.exploded && b.exploded) {
      childrenOf(ctx, kind).forEach((id, i) => (delays[id] = i * STAGGER.explode));
      if (kind === 'cert') delays['cert.thumbprint'] = 4 * STAGGER.explode;
      if (kind === 'csr') delays['csr.privateKey'] = 0;
    }
    // Children unfold one after another, top to bottom.
    const newly = b.open.filter((id, i) => a.open[i] !== id);
    for (const parent of newly) childrenOf(ctx, parent).forEach((id, i) => (delays[id] = 40 + i * STAGGER.unfold));
  }
  if (next.scene === 'flow' && next.flowStage === 3 && prev.flowStage !== 3) {
    FLOW_TOKENS.forEach((t, i) => (delays[`flow.tok.${t.id}`] = 260 + i * STAGGER.tokens));
    delays['flow.seal'] = 260 + FLOW_TOKENS.length * STAGGER.tokens + 200;
  }
  return delays;
}
