# Motion system

## Principles

- **State, not animation, is the source of truth.** `computeFrame(state, viewport)` returns the exact target geometry for every element. Motion only interpolates between two such frames.
- **Exact reversibility.** The assembled layout is computed from state alone, never accumulated, so explode → explore → reassemble returns to identical pixels (unit- and browser-tested).
- **Deterministic.** `sample(transition, t)` is a pure function. The interactive app feeds it `performance.now()`; the film feeds it `t` from the timeline.
- **One hero motion at a time.** Supporting elements start later (stagger) and use a gentler curve.
- **Interruptible.** A new action starts its transition from the currently sampled frame.

## Tokens (`src/motion/tokens.js`)

| Token | ms | Use |
| --- | --- | --- |
| explode | 980 | Block separates into layers; camera untilts |
| collapse | 860 | Reassembly |
| unfold / fold | 720 / 600 | A layer releases or gathers its children |
| select | 320 | Emphasis moves; nothing travels |
| trace | 900 | Provenance colours and paths |
| scene | 1050 | Between artifacts, compare and flow |
| encoding | 640 | Structure ↔ encoded bytes |
| flowStage / flowStageLong | 1500 / 2400 | Issuance stages (long for evaluation, issuance, verification) |

Stagger: 70 ms between exploding layers, 38 ms between unfolding children, 90 ms between copied certificate fields. Holds for autoplay: 3.2 s / 4.2 s after each stage.

Easing: `hero` cubic-bezier(0.66, 0, 0.2, 1), monotonic with no overshoot; `support` (0.33, 0, 0.15, 1) for delayed elements.

## Element properties

Every element is interpolated over: `x, y, w, h, z` (geometry), `o` (opacity), `k` (content scale), `d` (assembled face ↔ exploded label), `s` (selection), `dim`, `sp` (spine), `pv` (provenance colour), `r` (list reveal), `op` (open), `t` (path trace). The renderer maps them to `transform`, size and CSS variables; there are no CSS transitions.

## Camera

Assembled artifacts sit under a slight tilt (rotateX 12°, rotateY −15°, perspective 1800 px) so the layer strata read as depth. Exploding removes the tilt as the layers spread, then the camera stays still while the learner reads.

## Reduced motion

`prefers-reduced-motion` (or the Reduced motion toggle) sets every duration to zero: states change instantly, positions never animate.

## Film

`src/film/timeline.js` builds 22 shots from real reducer actions. `frameAt(t)` = sample(transition from shot *i−1* to shot *i*, t). Tests assert that each transition finishes before the next shot, captions do not overlap and stay at or under five words per second, and the final frame equals the opening frame. The film lays out a 1440×810 stage and scales it to 1920×1080 for legible text.
