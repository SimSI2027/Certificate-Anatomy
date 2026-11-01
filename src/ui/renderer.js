// Applies a sampled frame to the DOM. Stateless apart from the element cache:
// the same frame always produces the same DOM styles.

import { buildElement, elementType, isInteractive, PATH_COLORS } from './content.js';
import { RELATIONSHIPS, RELATION_KINDS } from '../anatomy/relationships.js';
import { CAMERA } from '../motion/tokens.js';

/** Paint order for non-structural elements: frames under the values copied into them. */
function paintRank(id) {
  if (id.startsWith('flow.zone.')) return 1e5;
  if (id === 'flow.newcert') return 2e5;
  if (id.startsWith('flow.tok.') || id === 'flow.seal') return 3e5;
  return 2.5e5;
}
const r1 = (v) => Math.round(v * 10) / 10;

export class Renderer {
  constructor(stage, ctx, { onActivate } = {}) {
    this.ctx = ctx;
    this.stage = stage;
    this.camera = stage.querySelector('.camera');
    this.world = stage.querySelector('.world');
    this.links = stage.querySelector('.links');
    this.nodes = new Map();
    this.onActivate = onActivate;
    this.order = this.#creationOrder();
    stage.style.perspective = `${CAMERA.perspective}px`;
  }

  /** Stable DOM order: artifact trees depth-first, so Tab follows structure. */
  #creationOrder() {
    const order = [];
    const walk = (n) => {
      order.push(n.id);
      n.children.forEach(walk);
    };
    walk(this.ctx.trees.cert);
    order.push('cert.thumbprint');
    order.push('csr.privateKey');
    walk(this.ctx.trees.csr);
    return new Map(order.map((id, i) => [id, i]));
  }

  #ensure(id) {
    let el = this.nodes.get(id);
    if (el) return el;
    el = buildElement(id, this.ctx);
    if (!el) return null;
    el.hidden = true;
    if (isInteractive(id)) {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.onActivate?.(id);
      });
    }
    // Insert by structural order, so focus order is meaningful.
    const rank = this.order.has(id) ? this.order.get(id) : paintRank(id);
    el.dataset.rank = rank;
    const after = [...this.world.children].find((c) => Number(c.dataset.rank) > rank);
    this.world.insertBefore(el, after || null);
    this.nodes.set(id, el);
    return el;
  }

  apply(frame) {
    const { cam, els, meta } = frame;
    const area = meta?.area;
    if (area) {
      const ox = area.x + area.w / 2;
      const oy = area.y + area.h / 2;
      this.stage.style.perspectiveOrigin = `${ox}px ${oy}px`;
      this.camera.style.transformOrigin = `${ox}px ${oy}px`;
    }
    this.camera.style.transform =
      `translate3d(${r1(cam.tx)}px, ${r1(cam.ty)}px, 0) rotateX(${r1(cam.rx)}deg) rotateY(${r1(cam.ry)}deg) scale(${cam.s})`;

    const paths = [];
    for (const id in els) {
      const p = els[id];
      if (elementType(id) === 'path') {
        paths.push([id, p]);
        continue;
      }
      const visible = p.o * (1 - 0.7 * p.dim);
      let el = this.nodes.get(id);
      if (!el && visible < 0.01) continue;
      el = el || this.#ensure(id);
      if (!el) continue;
      if (visible < 0.01) {
        if (!el.hidden) el.hidden = true;
        continue;
      }
      if (el.hidden) el.hidden = false;
      const st = el.style;
      st.transform = `translate3d(${r1(p.x)}px, ${r1(p.y)}px, ${r1(p.z)}px) scale(${Math.round(p.k * 1000) / 1000})`;
      st.width = `${r1(p.w)}px`;
      st.height = `${r1(p.h)}px`;
      st.opacity = String(Math.round(visible * 1000) / 1000);
      st.setProperty('--d', (Math.round(p.d * 100) / 100).toString());
      st.setProperty('--s', (Math.round(p.s * 100) / 100).toString());
      st.setProperty('--sp', (Math.round(p.sp * 100) / 100).toString());
      st.setProperty('--pv', (Math.round(p.pv * 100) / 100).toString());
      st.setProperty('--op', (Math.round(p.op * 100) / 100).toString());
      st.setProperty('--r', (Math.round(p.r * 100) / 100).toString());
      if (el.classList.contains('plate')) {
        const size = p.h < 52 ? 'xs' : p.h < 84 ? 'sm' : p.h < 140 ? 'md' : 'lg';
        if (el.dataset.size !== size) el.dataset.size = size;
        const settledEnough = visible > 0.5 && p.d > 0.5;
        el.tabIndex = settledEnough ? 0 : -1;
        // Assembled layers sit behind the block: the block alone takes the click.
        st.pointerEvents = settledEnough ? '' : 'none';
        if (this.ctx.node(id)?.children?.length) el.setAttribute('aria-expanded', p.op > 0.5 ? 'true' : 'false');
        el.setAttribute('aria-pressed', p.s > 0.5 ? 'true' : 'false');
      }
      if (el.classList.contains('block') || el.classList.contains('keymat')) {
        el.tabIndex = visible > 0.5 ? 0 : -1;
        st.pointerEvents = visible > 0.5 ? '' : 'none';
      }
    }
    // Hide elements absent from the frame entirely.
    for (const [id, el] of this.nodes) if (!(id in els) && !el.hidden) el.hidden = true;

    this.#drawLinks(els, paths);
  }

  #rect(els, id) {
    const p = els[id];
    if (!p) return null;
    return { x: p.x, y: p.y, w: p.w * p.k, h: p.h * p.k, o: p.o * (1 - 0.7 * p.dim) };
  }

  #drawLinks(els, paths) {
    const parts = [];
    // Structural brackets: parent plate -> its visible children.
    for (const [id, node] of this.ctx.index) {
      if (!node.children.length || id === 'cert' || id === 'csr') continue;
      const pr = this.#rect(els, id);
      if (!pr || pr.o < 0.02 || els[id].d < 0.5) continue;
      const kids = node.children.map((c) => this.#rect(els, c.id)).filter((r) => r && r.o > 0.02);
      if (!kids.length) continue;
      const left = Math.min(...kids.map((k) => k.x));
      if (left < pr.x + pr.w + 6) continue; // children not in their own column yet
      const o = Math.min(pr.o, Math.max(...kids.map((k) => k.o)));
      const sx = pr.x + pr.w, sy = pr.y + pr.h / 2;
      const bx = left - 14;
      const ys = kids.map((k) => k.y + k.h / 2);
      let d = `M${r1(sx)},${r1(sy)} H${r1(bx)} M${r1(bx)},${r1(Math.min(...ys, sy))} V${r1(Math.max(...ys, sy))}`;
      for (const k of kids) d += ` M${r1(bx)},${r1(k.y + k.h / 2)} H${r1(k.x - 2)}`;
      parts.push(`<path d="${d}" stroke="var(--edge-hi)" stroke-opacity="${r1(o)}" />`);
    }

    for (const [id, p] of paths) {
      if (p.o < 0.01) continue;
      const o = p.o * (1 - 0.8 * p.dim);
      if (id.startsWith('rel.')) parts.push(this.#relationPath(id.slice(4), els, p, o));
      else if (id === 'link.keypair') parts.push(this.#pairPath(els, 'csr.privateKey', p.r ? 'csr.cri.spki.publicKey' : 'csr.cri.spki', o, 'mathematical pair, public half is in the CSR'));
      else if (id === 'flow.pair') parts.push(this.#pairPath(els, 'flow.key', 'cert', o, 'public keys match'));
    }
    this.links.innerHTML = parts.join('');
  }

  #dash(len, t) {
    return `stroke-dasharray="${r1(len)} ${r1(len)}" stroke-dashoffset="${r1(len * (1 - t))}"`;
  }

  #relationPath(relId, els, p, o) {
    const rel = RELATIONSHIPS.find((r) => r.id === relId);
    const color = PATH_COLORS[rel.kind];
    const width = p.s > 0.5 ? 2.6 : 1.5;
    const a = rel.csr ? this.#rect(els, rel.csr) : null;
    const b = rel.cert ? this.#rect(els, rel.cert) : null;
    const op = r1(o * Math.min(a ? a.o : 1, b ? b.o : 1));
    if (op < 0.02) return '';
    if (a && b) {
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      const mx = (x1 + x2) / 2;
      const len = Math.abs(x2 - x1) + Math.abs(y2 - y1) * 0.9;
      return `<path d="M${r1(x1)},${r1(y1)} C${r1(mx)},${r1(y1)} ${r1(mx)},${r1(y2)} ${r1(x2)},${r1(y2)}" stroke="${color}" stroke-width="${width}" stroke-opacity="${op}" ${this.#dash(len, p.t)} />`;
    }
    if (a) {
      const x1 = a.x + a.w, y = a.y + a.h / 2, x2 = x1 + 44;
      const label = rel.kind === 'consumed' ? 'not copied' : 'selects policy';
      return `<path d="M${r1(x1)},${r1(y)} H${r1(x2)} M${r1(x2)},${r1(y - 7)} V${r1(y + 7)}" stroke="${color}" stroke-width="${width}" stroke-opacity="${op}" />` +
        `<text class="rel-label" x="${r1(x2 + 8)}" y="${r1(y + 4)}" fill-opacity="${op}">${label}</text>`;
    }
    const x2 = b.x, y = b.y + b.h / 2, x1 = x2 - 30;
    const label = rel.kind === 'config' ? 'CA config' : rel.kind === 'derived' ? 'derived' : 'CA';
    return `<path d="M${r1(x1)},${r1(y)} H${r1(x2)}" stroke="${color}" stroke-width="${width}" stroke-opacity="${op}" />` +
      `<circle class="stub-dot" cx="${r1(x1)}" cy="${r1(y)}" r="3.2" fill="${color}" fill-opacity="${op}" />` +
      `<text class="rel-label" x="${r1(x1 - 8)}" y="${r1(y + 4)}" text-anchor="end" fill-opacity="${op}">${label}</text>`;
  }

  #pairPath(els, fromId, toId, o, label) {
    const a = this.#rect(els, fromId);
    const b = this.#rect(els, toId);
    if (!a || !b) return '';
    const op = r1(o * Math.min(a.o, b.o));
    if (op < 0.02) return '';
    const x1 = a.x + a.w, y1 = a.y + a.h / 2;
    const toLeft = b.x > x1;
    const x2 = toLeft ? b.x : b.x + b.w / 2, y2 = toLeft ? b.y + b.h / 2 : b.y + b.h;
    const mx = (x1 + x2) / 2;
    const d = toLeft
      ? `M${r1(x1)},${r1(y1)} C${r1(mx)},${r1(y1)} ${r1(mx)},${r1(y2)} ${r1(x2)},${r1(y2)}`
      : `M${r1(a.x + a.w / 2)},${r1(a.y)} L${r1(x2)},${r1(y2)}`;
    // Label sits just outside the key plate, clear of the structures it links.
    const lx = toLeft ? x1 + 6 : a.x + 4;
    const ly = toLeft ? y1 + 18 : a.y - 8;
    return `<path d="${d}" stroke="var(--key)" stroke-width="1.5" stroke-dasharray="5 5" stroke-opacity="${op}" />` +
      `<text class="rel-label" x="${r1(lx)}" y="${r1(ly)}" text-anchor="start" fill-opacity="${op}">${label}</text>`;
  }
}

export { RELATION_KINDS };
