#!/usr/bin/env node
/**
 * Render the vitest coverage summary (reports/coverage/coverage-summary.json)
 * as a markdown table into the GitHub Actions job summary (and stdout).
 * No-op with a notice if the file is missing.
 */
import {readFileSync, existsSync, appendFileSync} from 'node:fs';

const FILE = 'reports/coverage/coverage-summary.json';
const out = process.env.GITHUB_STEP_SUMMARY;
const write = md => {
  process.stdout.write(md + '\n');
  if (out) appendFileSync(out, md + '\n');
};

if (!existsSync(FILE)) {
  write('> ⚠️ No coverage summary found (skipped).');
  process.exit(0);
}

const {total} = JSON.parse(readFileSync(FILE, 'utf8'));
const pct = m => (total[m] ? `${total[m].pct}%` : 'n/a');
const icon = p => (p >= 85 ? '🟢' : p >= 70 ? '🟡' : '🔴');

write('### 🧪 Unit test coverage (`tests/utils`)');
write('');
write('| Metric | Coverage | |');
write('|---|---|:-:|');
for (const m of ['statements', 'branches', 'functions', 'lines']) {
  const p = total[m]?.pct ?? 0;
  write(`| ${m[0].toUpperCase() + m.slice(1)} | ${pct(m)} | ${icon(p)} |`);
}
write('');
write('_Threshold: 85% statements/functions/lines, 80% branches._');
