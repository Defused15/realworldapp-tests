---
name: setup-project
description: One-time project infrastructure setup. Scans the live app to understand auth mechanism, routes, and API shape — then generates base.page.ts, fixtures, global-setup, factories, api-helpers, and static test data. Run this once before any /gen-test.
---

Generate the full test infrastructure for this project from scratch. Run once. After this, `/gen-test` is ready to use.

## Phase 1 — Understand the app

### Scan the auth flow

```
browser_navigate(<BASE_URL>/signin or /login)
browser_snapshot()            ← find username/password inputs and submit button
browser_take_screenshot()
```

Submit the form with valid credentials from env vars (`TEST_USER_USERNAME` / `TEST_USER_PASSWORD`) and capture:

```
browser_network_requests()    ← find the auth API call: method, URL, request body, response shape
```

From the response, determine:

- **API base URL** (e.g. `http://localhost:3001`)
- **Auth endpoint** (e.g. `POST /login`)
- **Auth location**: Is the auth state in the response body (token)? A cookie? A header?
- **Auth storage in the browser**: Does the app use `localStorage`? A session cookie? `sessionStorage`?
  - Navigate to `/` after login, open browser storage → look for a `token` key in localStorage or an auth cookie
  - If unsure: check both `localStorage.getItem('token')` and `document.cookie` via `browser_evaluate`

### Scan 2-3 more pages

Navigate to the home page and one protected page (e.g. transactions, user settings) to understand:

- URL patterns (slug-based? query params?)
- Common navigation elements (navbar, user menu)

## Phase 2 — Install dependencies

```bash
grep -q "@axe-core/playwright" package.json || npm install --save-dev @axe-core/playwright
grep -q "@faker-js/faker" package.json || npm install --save-dev @faker-js/faker
```

## Phase 3 — Generate infrastructure

Spawn the `support-agent` with `mode: full` and the auth brief:

```
App base URL: <url>
Auth endpoint: POST /login (or whatever was found)
Auth request body: { "username": string, "password": string }
Auth response: { "user": { "id": string, "username": string, ... } }
Auth storage: session cookie connect.sid (or localStorage key / sessionStorage key)
Protected route example: / (home — transactions dashboard)
API base URL: <url>
```

## Phase 4 — Verify

```bash
npx tsc --noEmit
```

If it passes: report files generated and say "project is ready — run `/gen-test <feature> on <url>` to start testing".

If it fails: show the errors, fix them, re-run.

## Invocation

```
/setup-project http://localhost:3000
```
