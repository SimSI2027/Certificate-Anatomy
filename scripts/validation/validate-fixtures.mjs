#!/usr/bin/env node
import { runFixtureChecks } from './fixture-checks.mjs';

const checks = runFixtureChecks();
let failed = 0;
for (const c of checks) {
  if (!c.ok) failed++;
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok || !c.detail ? '' : `\n      ${c.detail}`}`);
}
console.log(`\n${checks.length - failed}/${checks.length} fixture checks passed.`);
process.exit(failed ? 1 : 0);
