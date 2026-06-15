/**
 * Flaky-test analytics.
 *
 * Parses a Playwright JSON report and surfaces tests that only passed on retry
 * (Playwright marks these `status: 'flaky'`). Writes a markdown summary to the
 * GitHub Actions step summary when running in CI, otherwise to stdout.
 *
 * Usage: npx tsx tests/scripts/flaky-summary.ts [report.json ...]
 * Default report path: playwright-report/report.json
 *
 * Always exits 0 — flaky detection is informative. The build gate against
 * flakiness is the `@quarantine` tag (excluded from gating runs), not this
 * report. See docs/test-strategy.md → "Flaky tests & quarantine".
 */
import {appendFileSync, existsSync, readFileSync} from 'node:fs';

interface PwResult {
  status: string;
  retry: number;
  duration: number;
}
interface PwTest {
  projectName: string;
  status: string; // 'expected' | 'unexpected' | 'flaky' | 'skipped'
  results: PwResult[];
}
interface PwSpec {
  title: string;
  file?: string;
  tests: PwTest[];
}
interface PwSuite {
  title: string;
  file?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  suites?: PwSuite[];
  stats?: {flaky?: number; expected?: number; unexpected?: number};
}

interface FlakyRow {
  title: string;
  file: string;
  project: string;
  retries: number;
}

function collectFlaky(
  suite: PwSuite,
  ancestry: string[],
  out: FlakyRow[],
): void {
  const here = [...ancestry, suite.title].filter(Boolean);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      if (t.status === 'flaky') {
        out.push({
          title: [...here, spec.title].join(' › '),
          file: spec.file ?? suite.file ?? '?',
          project: t.projectName || 'default',
          retries: Math.max(0, t.results.length - 1),
        });
      }
    }
  }
  for (const child of suite.suites ?? []) collectFlaky(child, here, out);
}

function readReport(path: string): PwReport | undefined {
  if (!existsSync(path)) {
    console.warn(`⚠️  report not found: ${path}`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as PwReport;
  } catch (err) {
    console.warn(`⚠️  could not parse ${path}: ${(err as Error).message}`);
    return undefined;
  }
}

function main(): void {
  const paths =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2)
      : ['playwright-report/report.json'];

  const flaky: FlakyRow[] = [];
  for (const p of paths) {
    const report = readReport(p);
    if (report) for (const s of report.suites ?? []) collectFlaky(s, [], flaky);
  }

  const lines: string[] = [];
  if (flaky.length === 0) {
    lines.push('## 🟢 Flaky tests: none', '', 'No tests passed only on retry.');
  } else {
    lines.push(
      `## 🟡 Flaky tests: ${flaky.length}`,
      '',
      'These passed only after a retry — investigate or `@quarantine` them.',
      '',
      '| Test | Project | Retries | File |',
      '| --- | --- | --- | --- |',
    );
    for (const f of flaky) {
      lines.push(
        `| ${f.title} | ${f.project} | ${f.retries} | \`${f.file}\` |`,
      );
    }
  }
  const md = lines.join('\n') + '\n';

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, md);
  console.log(md);
}

main();
