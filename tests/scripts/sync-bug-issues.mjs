#!/usr/bin/env node
/**
 * Sync docs/bug-reports/bugs.yml → GitHub issues.
 *
 * For each bug in the manifest:
 *   status: open      → ensure an OPEN issue exists (create, or reopen if closed)
 *   status: resolved  → close the matching issue with a comment
 *
 * Issues are matched idempotently by the `[<id>]` prefix in the title plus the
 * `app-bug` label, so re-runs never create duplicates.
 *
 * Env:
 *   GITHUB_TOKEN       (required) — repo-scoped token (the Actions token works)
 *   GITHUB_REPOSITORY  (required) — "owner/repo" (set automatically in Actions)
 *   DRY_RUN            (optional) — "1" to log actions without calling the API
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const MANIFEST = resolve(REPO_ROOT, 'docs/bug-reports/bugs.yml');

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const dryRun = process.env.DRY_RUN === '1';
if (!token || !repo) {
  console.error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  process.exit(1);
}
const API = `https://api.github.com/repos/${repo}`;

async function gh(method, path, body) {
  if (dryRun && method !== 'GET') {
    console.log(`[dry-run] ${method} ${path} ${body ? JSON.stringify(body) : ''}`);
    return {};
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function ensureLabel(name, color, description) {
  try {
    await gh('GET', `/labels/${encodeURIComponent(name)}`);
  } catch {
    console.log(`Creating label "${name}"`);
    await gh('POST', '/labels', {name, color, description}).catch(() => {});
  }
}

async function allIssues(label) {
  const out = [];
  for (let page = 1; ; page++) {
    const batch = await gh(
      'GET',
      `/issues?state=all&labels=${encodeURIComponent(label)}&per_page=100&page=${page}`
    );
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

function severityLabel(sev) {
  return `severity:${String(sev).toLowerCase()}`;
}

function issueBody(bug) {
  return [
    `**Bug ID:** \`${bug.id}\``,
    `**Severity:** ${bug.severity}`,
    `**Area:** ${bug.area}`,
    '',
    `Full reproduction & analysis: [\`${bug.report}\`](${bug.report})`,
    '',
    '---',
    '_Auto-managed by `.github/workflows/bug-report-sync.yml` from `docs/bug-reports/bugs.yml`._',
    '_Close by setting `status: resolved` in the manifest (do not close by hand)._',
  ].join('\n');
}

async function main() {
  const manifest = yaml.load(readFileSync(MANIFEST, 'utf8'));
  const baseLabel = (manifest.labels && manifest.labels[0]) || 'app-bug';
  const bugs = manifest.bugs || [];

  await ensureLabel(baseLabel, 'd73a4a', 'Defect in the application under test');
  for (const sev of ['critical', 'high', 'medium', 'low']) {
    await ensureLabel(severityLabel(sev), 'cccccc', `Severity: ${sev}`);
  }

  const existing = await allIssues(baseLabel);
  const byId = new Map();
  for (const issue of existing) {
    const m = issue.title.match(/^\[([A-Z0-9-]+)\]/);
    if (m) byId.set(m[1], issue);
  }

  let created = 0,
    closed = 0,
    reopened = 0,
    untouched = 0;

  for (const bug of bugs) {
    const title = `[${bug.id}] ${bug.title}`;
    const labels = [baseLabel, severityLabel(bug.severity)];
    const issue = byId.get(bug.id);
    const wantOpen = (bug.status || 'open') === 'open';

    if (wantOpen) {
      if (!issue) {
        console.log(`CREATE ${title}`);
        await gh('POST', '/issues', {title, body: issueBody(bug), labels});
        created++;
      } else if (issue.state === 'closed') {
        console.log(`REOPEN #${issue.number} ${title}`);
        await gh('PATCH', `/issues/${issue.number}`, {state: 'open'});
        await gh('POST', `/issues/${issue.number}/comments`, {
          body: 'Reopened: manifest marked this bug `open` again.',
        });
        reopened++;
      } else {
        untouched++;
      }
    } else {
      if (issue && issue.state === 'open') {
        console.log(`CLOSE #${issue.number} ${title}`);
        await gh('POST', `/issues/${issue.number}/comments`, {
          body: 'Resolved: marked `status: resolved` in `docs/bug-reports/bugs.yml`.',
        });
        await gh('PATCH', `/issues/${issue.number}`, {state: 'closed', state_reason: 'completed'});
        closed++;
      } else {
        untouched++;
      }
    }
  }

  const summary = `Bug sync: ${created} created, ${closed} closed, ${reopened} reopened, ${untouched} unchanged (${bugs.length} bugs in manifest).`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const {appendFileSync} = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 🐞 ${summary}\n`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
