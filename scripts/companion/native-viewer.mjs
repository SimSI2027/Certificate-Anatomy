#!/usr/bin/env node
// Local-only companion that opens an allowlisted public certificate (.cer) in the
// native Windows Certificate Viewer. Never used by the public GitHub Pages build.
//
// Security model:
//  - binds to 127.0.0.1 only
//  - fixed allowlist of artifact IDs -> fixed .cer paths (no paths accepted from the client)
//  - per-session random token, compared in constant time
//  - exact Origin allowlist (the local app origins only) and Host check
//  - no file enumeration, no PFX/key access, no Administrator rights needed

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const ARTIFACTS = Object.freeze({
  leaf: 'fixtures/certificates/app-simsi2027-test.cer',
  issuing: 'fixtures/certificates/simsi2027-issuing-ca-01.cer',
  root: 'fixtures/certificates/simsi2027-root-ca.cer',
});

export const DEFAULT_ORIGINS = Object.freeze(['http://127.0.0.1:5173', 'http://127.0.0.1:4173']);

export function windowsOpener(absPath) {
  // cryptext.dll is the shell handler Windows uses for .cer files; no shell is involved.
  const child = spawn('rundll32.exe', ['cryptext.dll,CryptExtOpenCER', absPath], { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
}

function tokenOk(expected, got) {
  if (typeof got !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createCompanionServer({ token, port, origins = DEFAULT_ORIGINS, opener = windowsOpener }) {
  if (!token || token.length < 32) throw new Error('A session token of at least 32 characters is required.');
  const server = createServer((req, res) => {
    const origin = req.headers.origin;
    const allowedOrigin = origin && origins.includes(origin) ? origin : null;
    const send = (code, body) => {
      const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
        headers.Vary = 'Origin';
      }
      res.writeHead(code, headers);
      res.end(JSON.stringify(body));
    };

    const actualPort = server.address()?.port;
    if (req.headers.host !== `127.0.0.1:${actualPort}`) return send(421, { error: 'host' });

    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });

    if (origin && !allowedOrigin) return send(403, { error: 'origin' });

    if (req.method === 'OPTIONS' && req.url === '/open') {
      if (!allowedOrigin) return send(403, { error: 'origin' });
      res.writeHead(204, {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        'Access-Control-Max-Age': '60',
        Vary: 'Origin',
      });
      return res.end();
    }

    if (req.method !== 'POST' || req.url !== '/open') return send(404, { error: 'not found' });
    if (!allowedOrigin) return send(403, { error: 'origin' });
    if (!tokenOk(token, req.headers['x-session-token'])) return send(401, { error: 'token' });
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return send(415, { error: 'content type' });

    let body = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 256) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      let artifact;
      try {
        artifact = JSON.parse(body).artifact;
      } catch {
        return send(400, { error: 'json' });
      }
      if (typeof artifact !== 'string' || !Object.hasOwn(ARTIFACTS, artifact)) return send(400, { error: 'artifact' });
      const abs = join(ROOT, ARTIFACTS[artifact]);
      if (!abs.toLowerCase().endsWith('.cer') || !existsSync(abs)) return send(404, { error: 'missing' });
      opener(abs);
      return send(200, { opened: artifact });
    });
  });
  return new Promise((res) => server.listen(port, '127.0.0.1', () => res(server)));
}

// Run directly: print {port, token} as one JSON line for the launcher.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.CA_COMPANION_PORT || 47615);
  const origins = (process.env.CA_COMPANION_ORIGINS || DEFAULT_ORIGINS.join(',')).split(',');
  const token = randomBytes(32).toString('base64url');
  const server = await createCompanionServer({ token, port, origins });
  console.log(JSON.stringify({ port: server.address().port, token }));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
