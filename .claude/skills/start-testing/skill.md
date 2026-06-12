---
name: start-testing
description: Full autonomous testing pipeline. Generates tests (POM + Wave A + Wave B), runs the suite, debugs failures with specialized agents, loops until all pass or are triaged, then commits. Each phase can also be run independently.
---

Autonomous test pipeline for a feature. Run end-to-end or use individual skills standalone.

## Invocation

```
/start-testing <feature> on <url>
```

Example: `/start-testing signin on http://localhost:3000/signin`

---

## Phase 1 — Generate tests

Read `.claude/skills/gen-test/skill.md` and follow its instructions completely.

This produces:

- `tests/pages/<feature>.page.ts` (POM agent — runs first, others depend on it)
- `tests/ui/<feature>.spec.ts` (all UI categories: happy path, edge, security, a11y, visual)
- `tests/api/<feature>.spec.ts` (all API categories: functional, security, contract, performance)
- `docs/test-cases/<feature>.feature`

> If you only want to generate without running, use `/gen-test` standalone.

---

## Phase 2 — Run the full test suite for this feature

Run all generated files for the feature (UI + API):

```bash
npx playwright test \
  "tests/ui/<feature>" \
  "tests/api/<feature>" \
  --reporter=json,list 2>&1
```

Then parse failures from the JSON report:

```bash
node -e "
const r = JSON.parse(require('fs').readFileSync('./playwright-report/report.json', 'utf8'));
const failures = [];
function collect(s) {
  for (const spec of (s.specs || [])) {
    if (!spec.ok) failures.push({
      title: spec.title,
      file: spec.file,
      error: spec.tests?.[0]?.results?.[0]?.error?.message?.split('\n')[0] ?? 'unknown',
      screenshot: spec.tests?.[0]?.results?.[0]?.attachments?.find(a => a.name === 'screenshot')?.path ?? null,
    });
  }
  for (const sub of (s.suites || [])) collect(sub);
}
(r.suites || []).forEach(collect);
console.log(JSON.stringify(failures, null, 2));
"
```

If there are zero failures → jump to Phase 4 (commit).

---

## Phase 3 — Debug loop (max 3 iterations)

Repeat while failures exist AND iteration ≤ 3:

### 3a — Triage failures

Separate the failure list into:

- **UI failures**: files matching `tests/ui/`
- **API failures**: files matching `tests/api/`

### 3b — Spawn debug agents in parallel

For each UI failure, spawn a `ui-debug-agent` with:

```
Test file: <file>
Test name: <title>
Error message: <error>
Screenshot path: <screenshot or "none">
Trace path: check test-results/<feature>/ for .zip trace files
```

For each API failure, spawn an `api-debug-agent` with:

```
Test file: <file>
Test name: <title>
Error message: <error>
Response captured: none (read from test file context)
```

Spawn all debug agents in a **single parallel message**.

### 3c — Re-run previously failing tests

After all debug agents complete, re-run only the files that had failures:

```bash
npx playwright test <file1> <file2> ... --reporter=json,list 2>&1
```

Parse results again. If new failures remain → increment iteration, go back to 3a.

### Stopping conditions

- All tests pass (or are `test.skip`) → proceed to Phase 4
- Iteration reaches 3 → proceed to Phase 4, report remaining failures as "needs manual review"

---

## Phase 4 — Final report + commit

Print a summary table:

```
Feature: signin
─────────────────────────────────────────────────────────────────
 File                    Describes                     Pass Skip Fail
 tests/ui/signin.spec.ts Happy Path, Edge, Security,
                         Accessibility, Visual           18    1    0  ← 1 app bug
 tests/api/signin.spec.ts Functional, Security,
                         Contract, Performance           19    1    0  ← 1 app bug
 docs/test-cases/signin.feature  (Gherkin — no run)      —    —    —
─────────────────────────────────────────────────────────────────
 Total: 37 pass, 2 skipped (app bugs), 0 fail
```

If skipped tests exist, list the bug reports from the `test.skip` comments.

Then invoke the `/commit` skill to stage and commit all generated files.

> If you only want to commit without running this full pipeline, use `/commit` standalone.

---

## Phase 5 — Feedback loop (always runs)

**This phase always runs**, even if no failures occurred. It extracts learnings from the full cycle and updates agents + CLAUDE.md so future runs improve.

Read `.claude/skills/feedback/skill.md` and follow its instructions for `<feature>`.

This produces:

- `docs/bug-reports/<feature>-bugs.md` — formal bug report for every `test.skip`
- Updated agent `.md` files — concrete rules added to prevent same errors
- Updated `CLAUDE.md` — project-specific learnings appended

> The feedback loop is the memory of the system. Skip it only if explicitly asked.

---

## Standalone usage of each piece

Every component works independently:

- `/gen-test signin on http://localhost:3000/signin` — generate only
- `/debug-test tests/ui/signin.spec.ts` — debug one file manually
- `/feedback signin` — run feedback loop only (after tests already pass)
- `/commit` — commit whatever is staged
