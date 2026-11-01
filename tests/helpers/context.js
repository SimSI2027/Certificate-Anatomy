import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext } from '../../src/artifacts/context.js';
import { FIXTURE_FILES as F } from '../../src/scenario/scenario.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bytes = (rel) => new Uint8Array(readFileSync(join(ROOT, rel)));

let cached;
export function nodeContext() {
  cached ??= createContext({
    leafDer: bytes(F.leafDer),
    csrDer: bytes(F.csrDer),
    issuingDer: bytes(F.issuingDer),
    rootDer: bytes(F.rootDer),
    manifest: JSON.parse(readFileSync(join(ROOT, F.manifest), 'utf8')),
  });
  return cached;
}

export const VP = { w: 1440, h: 900 };
