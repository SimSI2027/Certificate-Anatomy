import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request } from 'node:http';
import { createCompanionServer, ARTIFACTS } from '../../scripts/companion/native-viewer.mjs';
import { readCompanionConfig } from '../../src/ui/companion.js';

const TOKEN = 'a'.repeat(43);
const ORIGIN = 'http://127.0.0.1:5173';
let server;
let port;
const opened = [];

function call({ method = 'POST', path = '/open', headers = {}, body, host }) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers: { Host: host || `127.0.0.1:${port}`, ...headers } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const good = { Origin: ORIGIN, 'X-Session-Token': TOKEN, 'Content-Type': 'application/json' };

beforeAll(async () => {
  server = await createCompanionServer({ token: TOKEN, port: 0, opener: (p) => opened.push(p) });
  port = server.address().port;
});
afterAll(() => new Promise((r) => server.close(r)));

describe('native viewer companion', () => {
  it('binds to loopback only', () => {
    expect(server.address().address).toBe('127.0.0.1');
  });
  it('opens an allowlisted CER with token and origin', async () => {
    const r = await call({ headers: good, body: JSON.stringify({ artifact: 'leaf' }) });
    expect(r.status).toBe(200);
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(opened.at(-1)).toMatch(/app-simsi2027-test\.cer$/);
  });
  it('rejects a missing or wrong token', async () => {
    expect((await call({ headers: { ...good, 'X-Session-Token': 'b'.repeat(43) }, body: '{"artifact":"leaf"}' })).status).toBe(401);
    const { 'X-Session-Token': _, ...noToken } = good;
    expect((await call({ headers: noToken, body: '{"artifact":"leaf"}' })).status).toBe(401);
  });
  it('rejects foreign origins, including the public site', async () => {
    const r = await call({ headers: { ...good, Origin: 'https://simsi2027.github.io' }, body: '{"artifact":"leaf"}' });
    expect(r.status).toBe(403);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('rejects a non-loopback Host header (DNS rebinding)', async () => {
    expect((await call({ headers: good, host: 'evil.example:80', body: '{"artifact":"leaf"}' })).status).toBe(421);
  });
  it('accepts only allowlisted artifact IDs, never paths', async () => {
    for (const artifact of ['../../package.json', 'C:\\Windows\\win.ini', 'leaf.pfx', 'toString', '__proto__', '']) {
      const r = await call({ headers: good, body: JSON.stringify({ artifact }) });
      expect(r.status, artifact).toBe(400);
    }
  });
  it('serves no files and no listings', async () => {
    for (const path of ['/', '/fixtures', '/open?artifact=leaf', '/../package.json']) {
      expect((await call({ method: 'GET', path, headers: { Origin: ORIGIN } })).status).not.toBe(200);
    }
  });
  it('allowlists only .cer files and never a key container', () => {
    for (const p of Object.values(ARTIFACTS)) expect(p).toMatch(/\.cer$/);
  });
  it('rejects oversized bodies', async () => {
    const r = await call({ headers: good, body: JSON.stringify({ artifact: 'leaf', pad: 'x'.repeat(2000) }) }).catch(() => ({ status: 0 }));
    expect(r.status).not.toBe(200);
  });
});

describe('browser companion config', () => {
  it('is absent on the public site (no fragment)', () => {
    expect(readCompanionConfig({ hash: '' })).toBeNull();
  });
  it('requires a valid port and a long token', () => {
    expect(readCompanionConfig({ hash: '#companion=47615&token=short' })).toBeNull();
    expect(readCompanionConfig({ hash: `#companion=80&token=${TOKEN}` })).toBeNull();
    expect(readCompanionConfig({ hash: `#companion=47615&token=${TOKEN}` })).toEqual({ port: 47615, token: TOKEN });
  });
});
