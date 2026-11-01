#!/usr/bin/env node
// Captures the visual-review set (output/review/, ignored by Git).
// Requires the dev server: npx vite (http://127.0.0.1:5173).

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'output', 'review');
mkdirSync(OUT, { recursive: true });
const URL = process.env.CA_URL || 'http://127.0.0.1:5173/';

const A = (id) => ({ type: 'activate', id });
const STATES = {
  '01-opening': [],
  '02-certificate-exploded': [A('cert')],
  '03-extensions-opened': [A('cert'), A('cert.tbs'), A('cert.tbs.extensions'), { type: 'select', id: null }],
  '04-san-selected': [A('cert'), A('cert.tbs'), A('cert.tbs.extensions'), A('cert.ext.san')],
  '05-cert-signature-selected': [A('cert'), A('cert.sigValue')],
  '06-trace': [{ type: 'goStep', step: 2 }],
  '07-relationships': [{ type: 'compare', id: 'cert.tbs.spki' }],
  '08-csr-assembled': [{ type: 'goStep', step: 3 }],
  '09-csr-exploded': [{ type: 'goStep', step: 3 }, A('csr'), A('csr.cri'), A('csr.cri.attributes'), A('csr.attr.extReq'), { type: 'select', id: null }],
  '10-public-key-selected': [{ type: 'goStep', step: 3 }, A('csr'), A('csr.cri'), A('csr.cri.spki'), A('csr.cri.spki.publicKey')],
  '11-csr-signature-selected': [{ type: 'goStep', step: 3 }, A('csr'), A('csr.sigValue')],
  '12-encoding-pem': [A('cert'), { type: 'setEncoding', mode: 'pem' }],
  '13-ca-issuance': [{ type: 'flowGo', stage: 3 }],
  '14-return-install': [{ type: 'flowGo', stage: 6 }],
  '15-verification': [{ type: 'flowGo', stage: 7 }],
};
const SIZES = [[1920, 1080], [1440, 900], [1366, 768], [390, 844]];

const browser = await chromium.launch();
let errors = 0;
for (const [w, h] of SIZES) {
  for (const reduced of [false, true]) {
    if (reduced && w !== 1440) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    for (const [name, actions] of Object.entries(STATES)) {
      if (reduced && !['02-certificate-exploded', '13-ca-issuance'].includes(name)) continue;
      const page = await ctx.newPage();
      page.on('pageerror', (e) => { errors++; console.error(name, e.message); });
      await page.goto(URL);
      await page.waitForFunction(() => window.__ca && window.__ca.settled());
      for (const a of actions) {
        await page.evaluate((x) => window.__ca.dispatch(x), a);
        await page.waitForFunction(() => window.__ca.settled(), null, { timeout: 10000 });
      }
      await page.waitForTimeout(60);
      await page.screenshot({ path: join(OUT, `${w}x${h}${reduced ? '-reduced' : ''}-${name}.png`) });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`Review screenshots in ${OUT}; page errors: ${errors}`);
process.exit(errors ? 1 : 0);
