---
name: gen-test
description: Generate a complete test suite for a page — scans with Playwright MCP, then runs 3 setup agents in parallel (Wave A), then 2 test agents in parallel (Wave B).
---

Generate a full test suite by scanning the live page and orchestrating agents in two parallel waves.

## Prerequisite check

Before doing anything, verify the project infrastructure exists:

```bash
test -f tests/fixtures/fixtures.ts && test -f tests/global-setup.ts && test -f tests/helpers/api-helpers.ts
```

If any file is missing → stop and tell the user: "Run `/setup-project <base-url>` first. The project infrastructure is not set up yet."

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

Read existing fixtures and support files:

```
Read: tests/fixtures/index.ts
Read: tests/utils/factories.ts
Read: tests/helpers/api-helpers.ts (may not exist yet)
```

Check dependencies and install if missing:

```bash
grep -q "@axe-core/playwright" package.json || npm install --save-dev @axe-core/playwright
grep -q "@faker-js/faker" package.json || npm install --save-dev @faker-js/faker
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

## Phase 5 — Report

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
