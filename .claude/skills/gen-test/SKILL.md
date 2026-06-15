---
name: gen-test
description: Generate a complete test suite for a page — scans with Playwright MCP, then runs 3 setup agents in parallel (Wave A), then 2 test agents in parallel (Wave B).
---

**REGLA #1 — ABSOLUTA:** Nunca leer ni acceder al repositorio de la aplicación bajo prueba. Todo el conocimiento de la UI y la API se obtiene del browser vivo (Playwright MCP: `browser_snapshot`, `browser_evaluate`, `browser_take_screenshot`, `browser_network_requests`) y de llamadas directas `curl`. Nunca uses `Read`, `Bash find`, ni ningún tool que acceda al source code del app.

---

Generate a full test suite by scanning the live page and orchestrating agents in two parallel waves.

## Prerequisite check

Before doing anything, verify the project infrastructure exists:

```bash
test -f tests/fixtures/fixtures.ts && test -f tests/global-setup.ts && test -f tests/helpers/api-helpers.ts
```

If any file is missing → stop and tell the user: "Run `/setup-project <base-url>` first. The project infrastructure is not set up yet."

## Phase 0 — Load the app workflow map (read first, before scanning)

If `docs/workflows/app-workflow-map.md` exists, **read it before anything else** and keep it in
context. It is the black-box map of the app produced by `exploratory-agent`: every route, the
`data-test` attributes per page (and which element carries them), user workflows, and observed
API calls (method, payload, status). This is OUR documentation — reading it does NOT violate
REGLA #1 (which forbids the app's source, not our own docs).

```bash
test -f docs/workflows/app-workflow-map.md && echo "workflow map: found" || echo "workflow map: missing — run /exploratory-test first for richer context"
```

Use the map to pre-fill the context brief (selectors, endpoints, workflows) so the live scan in
Phase 1 only confirms/fills gaps instead of rediscovering everything. Every agent in Wave A/B
also reads this file as a primary source — pass the relevant section in the brief.

## Phase 1 — Scan the page (sequential — do this yourself)

```
browser_navigate(url)
browser_snapshot()              ← accessibility tree: inputs, buttons, links, headings, roles
browser_take_screenshot()       ← visual confirmation
```

Trigger the primary form action (submit with dummy-valid data) and capture:

```
browser_network_requests()      ← HTTP calls: method, URL, request body, response body, status
```

**Extract all `data-test` attributes from the live DOM** — `browser_snapshot()` shows the
accessibility tree but may not expose `data-test` attributes. Use `browser_evaluate` to dump
every element that has one:

```javascript
// run via browser_evaluate:
Array.from(document.querySelectorAll('[data-test]')).map(el => ({
  tag: el.tagName,
  type: el.getAttribute('type'),
  id: el.id,
  dataTest: el.getAttribute('data-test'),
  text: el.textContent?.trim().slice(0, 40),
}));
```

Add all results to the context brief. **MUI TextField trap:** if you see a `data-test` on a
`<div>` (not an `<input>`), the wrapper carries the attr — pom-agent must use `locator('#id')`
for the actual `<input>` inside, not `getByTestId()`.

Read existing fixtures and support files:

```
Read: tests/fixtures/index.ts
Read: tests/utils/factories.ts
Read: tests/helpers/api-helpers.ts (may not exist yet)
```

Check dependencies and verify `testIdAttribute` config:

```bash
grep -q "@axe-core/playwright" package.json || npm install --save-dev @axe-core/playwright
grep -q "@faker-js/faker" package.json || npm install --save-dev @faker-js/faker
grep -q "testIdAttribute" playwright.config.ts || echo "WARN: testIdAttribute: 'data-test' missing from playwright.config.ts use: block — getByTestId() will match [data-testid] not [data-test]"
```

## Phase 2 — Build the context brief

Compose a structured brief from everything found. This is passed to every agent.

```
Feature: <name>
URL: <url>

--- UI Elements ---
Inputs:
  - input[type=text]     label="Username"  placeholder="Username"  required=true
  - input[type=password] label="Password"  placeholder="Password"  required=true
Buttons:
  - button "Sign in" (submits form)
Links:
  - "Don't have an account? Sign Up" → /signup
Error containers:
  - [role="alert"] (hidden by default, visible on failure)
Headings:
  - h1 "Sign in"

--- Fixtures available ---
  - signinPage (SigninPage — navigates to /signin)
  - homePage (HomePage)

--- API Endpoints ---
  POST /login
    request:  { "username": string, "password": string }
    success:  200 { "user": { "id", "username", "firstName", "lastName" } }
    error:    401 { "message": "Username or password is invalid" }

--- Auth ---
  mechanism: session cookie (connect.sid — set automatically after POST /login)
  auth required for this page: no

--- API base URL ---
  http://localhost:3001

--- data-test attributes (from browser_evaluate on live DOM) ---
  - data-test="signin-username"  → tag=DIV (MUI wrapper — use #username for actual input)
  - data-test="signin-submit"    → tag=BUTTON (direct — locator('[data-test="..."]') ok)
  - ... (list all found for this feature)
  Note: MUI TextField wrapper? (yes/no — if yes, use #id for inputs)
  Note: Always prefer locator('[data-test="..."]') over getByTestId() for config-independence.
        testIdAttribute: 'data-test' is set in playwright.config.ts (yes/no — from grep above).

--- navigate() waitFor anchor ---
  Pick one stable element that confirms the page's main component has rendered:
  e.g. submitButton, transactionList, heading — pom-agent adds waitFor({state:'visible'}) on it.

--- api-helpers.ts exists: yes/no ---
```

## Phase 3 — Wave A: 3 setup agents in parallel

Spawn all 3 in a **single parallel message**. They write to different files — no conflicts.

| Agent                          | Writes                                          | Skip if                                   |
| ------------------------------ | ----------------------------------------------- | ----------------------------------------- |
| `pom-agent`                    | `tests/pages/<feature>.page.ts` + fixture entry | —                                         |
| `support-agent` (mode: update) | any missing support files                       | all support files exist with real content |
| `gherkin-agent`                | `docs/test-cases/<feature>.feature`             | —                                         |

Wait for all 3 to complete before proceeding.

After pom-agent completes, append to the context brief:

```
--- POM ---
  POM file: tests/pages/<feature>.page.ts
  Fixture name: <featureName>Page (e.g. signinPage)
  Import: import {<Feature>Page} from '../pages/<feature>.page'
  Via fixture: import {test, expect} from '../fixtures'
```

## Phase 4 — Wave B: 2 test agents in parallel

Spawn both in a **single parallel message** with the updated context brief (including POM info).

| Agent            | Writes                        | Contains                                                                                                                                                         |
| ---------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-test-agent`  | `tests/ui/<feature>.spec.ts`  | All UI tests: happy `@smoke`, edge `@regression`, security `@security`, a11y `@a11y`, visual `@visual` — each in its own `test.describe` block                   |
| `api-test-agent` | `tests/api/<feature>.spec.ts` | All API tests: functional `@smoke`/`@regression`, security `@security`, contract `@contract`, performance `@performance` — each in its own `test.describe` block |

Wait for both Wave B agents to complete before proceeding to Wave C.

## Phase 5 — Wave C: data integrity agent

Spawn **after Wave B** — it uses the same context brief and knows which API endpoints exist.

| Agent                  | Writes                                       | Contains                                                                         |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `data-integrity-agent` | `tests/api/data-integrity/<feature>.spec.ts` | SQL cross-checks: API write → DB row, orphan checks, API vs DB count consistency |

Pass the context brief plus:

```
DB tables involved: <list the tables this feature writes to, derived from API endpoints>
Example — for transaction feature: transactions, likes, comments, notifications
Example — for signup feature: users
Example — for home feature: transactions, notifications (read-only, focus on API vs DB consistency)
```

The agent also creates `tests/helpers/db-helpers.ts` on first run (skips if already exists).

## Phase 6 — Report

After all agents complete:

- List every file created with test count and tags
- Run `npx tsc --noEmit` and surface any type errors
- Print reminders:
  - "Run `npx playwright test --update-snapshots --grep @visual` to create snapshot baselines, then commit the `__snapshots__/` directory"
  - "Run `npm install` if new packages were added"

## Example invocations

```
/gen-test signin on http://localhost:3000/signin
/gen-test signup on http://localhost:3000/signup
/gen-test new-transaction on http://localhost:3000/transaction/new
/gen-test user-settings on http://localhost:3000/user/settings
```
