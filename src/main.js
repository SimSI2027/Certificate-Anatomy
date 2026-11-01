import './ui/styles.css';
import { loadBrowserContext } from './artifacts/fixtures.js';
import { App } from './app.js';
import { readCompanionConfig, createCompanion } from './ui/companion.js';

const ctx = loadBrowserContext();
const companion = createCompanion(readCompanionConfig());
const app = new App(document.getElementById('app'), ctx, { companion });

// Test and automation hooks (read-only views plus dispatch).
window.__ca = {
  get state() { return app.state; },
  dispatch: (a) => app.dispatch(a),
  settled: () => app.settled(),
  frame: () => app.frame,
  ctx,
};
