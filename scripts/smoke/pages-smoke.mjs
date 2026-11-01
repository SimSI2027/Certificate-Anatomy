#!/usr/bin/env node
// Repository-subpath smoke test for the GitHub Pages build.
//   node scripts/smoke/pages-smoke.mjs                 serve dist/ under /Certificate-Anatomy/ and check it
//   node scripts/smoke/pages-smoke.mjs --url <site>    check a deployed site (e.g. the live Pages URL)

import { preview } from 'vite';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = '/Certificate-Anatomy/';
const urlArg = process.argv.indexOf('--url');

async function check(siteRoot) {
  const failures = [];
  const get = async (u) => {
    const res = await fetch(u, { redirect: 'follow' });
    return { status: res.status, text: await res.text(), type: res.headers.get('content-type') || '' };
  };
  const page = await get(siteRoot);
  if (page.status !== 200) failures.push(`index ${page.status}`);
  if (!page.text.includes('<title>Certificate Anatomy</title>')) failures.push('index title missing');
  const refs = [...page.text.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('data:'));
  if (!refs.length) failures.push('no asset references found');
  for (const ref of refs) {
    if (!ref.startsWith(BASE)) failures.push(`asset outside base path: ${ref}`);
    const r = await get(new URL(ref, siteRoot).href);
    if (r.status !== 200) failures.push(`${ref} -> ${r.status}`);
    if (ref.endsWith('.js') && /<html/i.test(r.text)) failures.push(`${ref} served HTML (SPA fallback)`);
  }
  const film = await get(new URL('film.html', siteRoot).href);
  if (film.status !== 200 || !film.text.includes('film')) failures.push(`film.html ${film.status}`);
  const mainJs = refs.find((r) => /\/assets\/main-.*\.js$/.test(r));
  if (mainJs) {
    const js = await get(new URL(mainJs, siteRoot).href);
    const fixtures = [...js.text.matchAll(/\/Certificate-Anatomy\/assets\/[\w.-]+\.(?:cer|csr|crl|inf|der|json|pem)/g)].map((m) => m[0]);
    for (const f of new Set(fixtures)) {
      const r = await get(new URL(f, siteRoot).href);
      if (r.status !== 200) failures.push(`${f} -> ${r.status}`);
    }
    if (!fixtures.length) {
      // Fixture URLs may live in a shared chunk; check any referenced chunk.
      const chunks = refs.filter((r) => r.endsWith('.js'));
      let found = 0;
      for (const c of chunks) {
        const t = (await get(new URL(c, siteRoot).href)).text;
        found += (t.match(/\/Certificate-Anatomy\/assets\/[\w.-]+\.cer/g) || []).length;
      }
      if (!found) failures.push('no fixture downloads referenced under the base path');
    }
  }
  return failures;
}

let failures;
if (urlArg > -1) {
  const site = process.argv[urlArg + 1];
  failures = await check(site.endsWith('/') ? site : `${site}/`);
  console.log(`Checked ${site}`);
} else {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.error('dist/ is missing. Run "npm run build" first.');
    process.exit(1);
  }
  const server = await preview({ root: ROOT, base: BASE, logLevel: 'error', preview: { port: 4179, strictPort: true, host: '127.0.0.1' } });
  try {
    failures = await check(`http://127.0.0.1:4179${BASE}`);
    // The site must not work from the domain root: proves the base path is applied.
    const rootRes = await fetch('http://127.0.0.1:4179/assets/');
    if (rootRes.status === 200 && (await rootRes.text()).includes('main-')) failures.push('assets also served at domain root');
  } finally {
    await new Promise((r) => server.httpServer.close(r));
  }
}
if (failures.length) {
  console.error(`Pages smoke test FAILED:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('Pages smoke test passed: index, assets, fixtures and film resolve under /Certificate-Anatomy/.');
