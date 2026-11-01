#!/usr/bin/env node
// Renders the deterministic film by calling window.renderAt(t) for every frame.
//   node scripts/film/render.mjs --stills   shot-boundary stills + draft contact sheet
//   node scripts/film/render.mjs --video    final MP4 (H.264, yuv420p, faststart, silent)
// Output lands in output/ (ignored by Git).

import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'output');
const STILLS = join(OUT, 'film-stills');
const args = new Set(process.argv.slice(2));
const mode = args.has('--video') ? 'video' : 'stills';

function ffmpegBin(name) {
  try {
    execFileSync(name, ['-version'], { stdio: 'pipe' });
    return name;
  } catch {
    throw new Error(`${name} not found on PATH. Install FFmpeg to render the film.`);
  }
}

async function withPage(fn) {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: true, host: '127.0.0.1' } });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('http://127.0.0.1:5199/film.html?capture');
    await page.waitForFunction(() => window.filmReady === true, null, { timeout: 30000 });
    const info = await page.evaluate(() => window.filmInfo);
    await fn(page, info);
    if (errors.length) throw new Error(`Console errors during render:\n${errors.join('\n')}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

async function renderStills() {
  rmSync(STILLS, { recursive: true, force: true });
  mkdirSync(STILLS, { recursive: true });
  const files = [];
  await withPage(async (page, info) => {
    const times = [];
    info.shots.forEach((s, i) => {
      const next = info.shots[i + 1]?.t ?? info.duration;
      if (i > 0) times.push([s.t + Math.min(0.45, (next - s.t) / 3), `${String(i).padStart(2, '0')}a-mid-${s.label}`]);
      times.push([Math.max(0, next - 0.05), `${String(i).padStart(2, '0')}b-settled-${s.label}`]);
    });
    times.push([1.5, '00-title'], [info.duration - 1, '99-end']);
    for (const [t, name] of times) {
      await page.evaluate((x) => window.renderAt(x), t);
      const file = join(STILLS, `${name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.png`);
      await page.screenshot({ path: file });
      files.push(file);
    }
    // Determinism check: the same t must produce identical pixels.
    const a = await (async () => { await page.evaluate(() => window.renderAt(44.1)); return page.screenshot(); })();
    await page.evaluate(() => window.renderAt(12.3));
    const b = await (async () => { await page.evaluate(() => window.renderAt(44.1)); return page.screenshot(); })();
    if (!a.equals(b)) throw new Error('renderAt(44.1) is not deterministic');
    console.log('Determinism check passed (renderAt(44.1) identical after re-render).');
  });
  const settledStills = files.filter((f) => /b-settled|00-title|99-end/.test(f)).sort();
  const sheet = join(OUT, 'certificate-anatomy-v0.1.0-contact-sheet.jpg');
  const ff = ffmpegBin('ffmpeg');
  const cols = 6;
  const rows = Math.ceil(settledStills.length / cols);
  const inputs = settledStills.flatMap((f) => ['-i', f]);
  const scale = settledStills.map((_, i) => `[${i}:v]scale=480:270[s${i}]`).join(';');
  const pads = Array.from({ length: cols * rows - settledStills.length }, (_, i) => `color=c=0x1b1e22:s=480x270:d=1[p${i}]`);
  const all = [...settledStills.map((_, i) => `[s${i}]`), ...pads.map((_, i) => `[p${i}]`)].join('');
  const layout = Array.from({ length: cols * rows }, (_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|');
  const graph = [scale, ...pads, `${all}xstack=inputs=${cols * rows}:layout=${layout}[out]`].join(';');
  execFileSync(ff, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', '-q:v', '3', sheet]);
  console.log(`Stills: ${files.length} in ${STILLS}`);
  console.log(`Contact sheet: ${sheet} (${statSync(sheet).size} bytes)`);
}

async function renderVideo() {
  mkdirSync(OUT, { recursive: true });
  const target = join(OUT, 'certificate-anatomy-v0.1.0.mp4');
  const ff = ffmpegBin('ffmpeg');
  await withPage(async (page, info) => {
    const total = Math.round(info.duration * info.fps);
    const enc = spawn(ff, [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-',
      '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(info.fps),
      '-movflags', '+faststart', target,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
    for (let n = 0; n < total; n++) {
      await page.evaluate((x) => window.renderAt(x), n / info.fps);
      const png = await page.screenshot({ type: 'png' });
      if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once('drain', r));
      if (n % 300 === 0) console.log(`frame ${n}/${total}`);
    }
    enc.stdin.end();
    await done;
  });
  console.log(`Film: ${target} (${existsSync(target) ? statSync(target).size : 0} bytes)`);
}

await (mode === 'video' ? renderVideo() : renderStills());
