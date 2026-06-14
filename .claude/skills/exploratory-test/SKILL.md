# Exploratory Test Skill

Launches the exploratory testing agent, then (optionally) runs pom-agents for each page discovered — all using the same session data, no re-scanning needed.

## When to use

- Before starting tests on a new feature (so agents have full workflow context)
- After significant app changes
- When test agents fail because they lack workflow context

## Usage

```
/exploratory-test              # Explore + write workflow map
/exploratory-test --pom        # Explore + write workflow map + generate all missing POMs
/exploratory-test --reset      # Re-seed DB before and after
```

## What it does

### Phase A — Exploratory agent (always runs)

The exploratory-agent:

1. Resets DB to seed state
2. Logs in as Heath93/s3cret via the UI
3. **Clicks EVERY interactive element on every page** — links, buttons, tabs, transaction rows, logos, filter controls, sliders — records what each one does (URL change, API call, DOM update)
4. Executes all 10 core workflows end-to-end (pay, request, like, comment, bank account, settings, notifications, logout)
5. Writes:
   - `docs/workflows/app-workflow-map.md` — master map
   - `docs/workflows/pages/{page}.md` — per-page context brief for each route
6. Resets DB to seed state

### Phase B — POM generation (only with --pom flag)

After Phase A completes, read `docs/workflows/pages/` and spawn pom-agents **in parallel** for each page that has no existing POM. Each pom-agent reads the pre-built context brief from `docs/workflows/pages/{page}.md` — no re-scanning, no extra tokens.

Orchestration:

1. List `docs/workflows/pages/*.md`
2. List `tests/pages/*.page.ts`
3. For each missing POM, spawn a pom-agent with the context brief
4. Spawn ALL missing pom-agents in a **single parallel message**
5. Run `npx tsc --noEmit` after all complete

## Output

- `docs/workflows/app-workflow-map.md` — commit to git
- `docs/workflows/pages/{page}.md` — one per route, commit to git
- `tests/pages/{feature}.page.ts` — POM files (--pom flag only)

## Prerequisites

- App running: `docker compose up -d`
- API accessible at http://localhost:3001

ARGUMENTS: $ARGUMENTS
