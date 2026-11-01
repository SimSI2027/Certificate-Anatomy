// Central motion tokens. No other module may hard-code a duration or easing.
// Character: engineered, controlled, minimal overshoot, deliberate holds.
// The hero motion runs first; supporting motion starts later and travels less.

export const DURATION = Object.freeze({
  explode: 980, // compact artifact separates into layers (camera untilts)
  collapse: 860, // exact reverse target: back to the assembled layout
  unfold: 720, // a layer releases its children into the next column
  fold: 600,
  select: 320, // emphasis moves between fields; nothing travels
  trace: 900, // provenance colours and relationship paths draw
  scene: 1050, // move between artifacts or into the flow
  encoding: 640, // structure <-> encoded bytes
  flowStage: 1500, // one step of the manual issuance flow
  flowStageLong: 2400, // stages that copy several fields or reveal lists
  inspector: 340,
});

/** Delay between siblings so related parts arrive as a readable sequence. */
export const STAGGER = Object.freeze({
  explode: 70,
  unfold: 38,
  tokens: 90,
  reveal: 0.42, // fraction of a stage spent revealing list items
});

/** Pause after a flow stage completes before autoplay advances. */
export const HOLD = Object.freeze({
  flowStage: 3200,
  flowStageLong: 4200,
});

/** Cubic-bezier control points. */
export const EASE = Object.freeze({
  hero: [0.66, 0, 0.2, 1], // decisive departure, long settle, no overshoot
  support: [0.33, 0, 0.15, 1], // gentler, for secondary elements
  fade: [0.4, 0, 0.6, 1],
});

/** Reduced motion: positions jump, only a short opacity settle remains. */
export const REDUCED = Object.freeze({
  durationScale: 0,
});

export const CAMERA = Object.freeze({
  assembledTilt: { rx: 12, ry: -15 },
  perspective: 1800,
});

export const LAYER_STEP = Object.freeze({
  y: 8, // visible strata under the assembled block
  z: -18,
});
