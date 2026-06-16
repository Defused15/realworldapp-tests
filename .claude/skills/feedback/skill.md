---
name: feedback
description: Retroalimentación post-test. Extrae learnings del ciclo de debug, documenta bugs en docs/bug-reports/, y actualiza los agentes para que no repitan los mismos errores.
---

Run the feedback loop for a feature after all tests pass (or are `test.skip`).

## Invocation

```
/feedback <feature>
```

Example: `/feedback signin`

---

## What this does

1. **Reads** `tests/ui/<feature>.spec.ts` and `tests/api/<feature>.spec.ts` for `test.skip` bug reports
2. **Reads** `test-results/` for any `error-context.md` files left by debug agents
3. **Spawns** the `feedback-agent` with all extracted data
4. **Produces:**
   - `docs/bug-reports/bugs.yml` — a structured entry per bug (one self-contained GitHub issue each via the sync workflow; no markdown report files)
   - Updated agent files — rules added to prevent same errors
   - Updated `CLAUDE.md` — project-specific learnings

---

## Steps

### Step 1 — Collect test.skip bugs

```bash
grep -n "test.skip\|SEVERITY\|BUG:\|Expected:\|Actual:\|Fix:" \
  tests/ui/<feature>.spec.ts \
  tests/api/<feature>.spec.ts 2>/dev/null
```

### Step 2 — Collect error contexts from debug loop

```bash
find test-results -name "error-context.md" 2>/dev/null | xargs cat 2>/dev/null
```

### Step 3 — Spawn feedback-agent

Read `.claude/agents/feedback-agent.md` and follow its instructions with:

```
Feature: <feature>
Test files: tests/ui/<feature>.spec.ts, tests/api/<feature>.spec.ts
Errors fixed: <summary from error-context.md files>
test.skip bugs: <extracted from step 1>
```

### Step 4 — Confirm updates

After the agent completes, report:

- Which agents were updated (and what rules were added)
- Which bug reports were written
- Which CLAUDE.md sections were updated
