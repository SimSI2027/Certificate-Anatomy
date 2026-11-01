import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runFixtureChecks } from '../../scripts/validation/fixture-checks.mjs';
import { ROOT } from '../helpers/context.js';

describe('fixture verification (independent Node crypto and OpenSSL)', () => {
  const checks = runFixtureChecks();
  for (const c of checks) {
    it(c.name, () => expect(c.ok, c.detail).toBe(true));
  }
});

describe('tracked files contain no private material', () => {
  const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT })
    .toString().split('\0').filter(Boolean);

  it('lists files to inspect', () => expect(tracked.length).toBeGreaterThan(10));

  it('has no key, PFX, P12, PKCS #8 or keystore files', () => {
    const bad = tracked.filter((f) => /\.(key|pfx|p12|pk8|jks|keystore|pvk|snk)$/i.test(f));
    expect(bad).toEqual([]);
  });

  it('has no PRIVATE KEY PEM marker in any file', () => {
    const marker = ['-----BEGIN', 'PRIVATE KEY-----'];
    const offenders = tracked.filter((f) => {
      if (/node_modules|\.(png|jpg|mp4|woff2?)$/i.test(f)) return false;
      try {
        const text = readFileSync(join(ROOT, f), 'latin1');
        return new RegExp(`${marker[0]} (RSA |EC |ENCRYPTED )?${marker[1]}`).test(text);
      } catch {
        return false;
      }
    });
    expect(offenders).toEqual([]);
  });

  it('has no generated media, shortcuts or build output', () => {
    const bad = tracked.filter((f) => /\.(mp4|lnk)$/i.test(f) || f.startsWith('dist/') || (f.startsWith('output/') && f !== 'output/README.md'));
    expect(bad).toEqual([]);
  });
});
