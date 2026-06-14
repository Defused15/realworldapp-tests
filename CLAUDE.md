# realworldapp-tests

Playwright E2E test suite for the Cypress Real World App (payment/transactions app).

## Tech stack

- **Playwright** — UI and API test runner
- **TypeScript** + **Google TypeScript Style (gts)**
- **@axe-core/playwright** — accessibility (WCAG 2.1 AA)
- **@faker-js/faker** — realistic test data
- **Husky + lint-staged** — pre-commit linting

## Prerequisites

The app runs in **Docker** with **PostgreSQL** (migrated via **Prisma**). Before running any tests:

```bash
docker compose up -d   # start the app + DB
npm run db:seed        # reset DB to known seed state
```

The app exposes `localhost:3000` (UI) and `localhost:3001` (API).

## Workflow

```
1. /setup-project http://localhost:3000   ← once per project
2. /gen-test <feature> on <url>           ← once per feature
3. /start-testing <feature> on <url>      ← gen + run + debug loop + commit
```

## Project structure

```
tests/
  ui/
    signin.spec.ts          ← ALL UI tests for signin in one file
    transactions.spec.ts
  api/
    signin.spec.ts          ← ALL API tests for signin in one file
    transactions.spec.ts
    data-integrity/
      transaction.spec.ts   ← SQL cross-checks for transaction feature (Wave C of gen-test)
      signup.spec.ts        ← SQL cross-checks for signup/user feature
  pages/
    base.page.ts            ← abstract base class
    signin.page.ts          ← locators + action methods for signin page
  fixtures/
    fixtures.ts             ← test.extend() + before/after hooks
    index.ts                ← re-exports test and expect
  utils/
    factories.ts            ← pure functions, no side effects: buildUser(), buildTransaction() with faker
  helpers/
    api-helpers.ts          ← async with side effects: createUser(), loginAs(), createTransaction()
    db-helpers.ts           ← SQL via docker exec psql: queryOne(), queryMany(), queryCount()
  data/
    xss-payloads.json       ← static attack strings for security tests
    invalid-inputs.json     ← boundary values for edge case tests
    seed-users.json         ← known users after db:seed (for IDOR, multi-user transactions)
  scripts/
    seed.ts                 ← POST /testData/seed — reset DB to baseline (npm run db:seed)
    teardown.ts             ← POST /testData/seed — same as seed (npm run db:reset)
  global-setup.ts         ← auth once before all UI tests
  global-teardown.ts
docs/
  test-cases/
    signin.feature        ← Gherkin scenarios for QA manual
```

## Test file structure — ONE file per feature per layer

**Organization rule: component first, test type within.**
Each spec file has one outer `test.describe` (feature), then one `test.describe` per UI component or API endpoint, then test-type sub-describes inside each. This makes `--grep "Remember Me"` return all tests for that component across every test type.

```typescript
// tests/ui/signin.spec.ts
test.describe('Signin', () => {
  test.describe('Form Submission', () => {   // main interaction / dominant component
    test.describe('Happy Path', () => {      // @smoke
    test.describe('Edge Cases', () => {      // @regression
    test.describe('Security', () => {        // @security
    test.describe('Accessibility', () => {   // @a11y
    test.describe('Visual', () => {          // @visual — page snapshots go here
  });
  test.describe('Remember Me', () => {       // checkbox component
    test.describe('Happy Path', () => {      // @smoke
    test.describe('Edge Cases', () => {      // @regression
    test.describe('Security', () => {        // @security
  });
  test.describe("Don't Have an Account Link", () => {  // link component
    test.describe('Happy Path', () => {      // @smoke
    test.describe('Edge Cases', () => {      // @regression
    test.describe('Accessibility', () => {   // @a11y
  });
});

// tests/api/signin.spec.ts
test.describe('signin API', () => {
  test.describe('POST /login', () => {       // endpoint as component
    test.describe('Functional', () => {      // @smoke + @regression
    test.describe('Security', () => {        // @security
    test.describe('Contract', () => {        // @contract
    test.describe('Performance', () => {     // @performance
  });
  test.describe('Remember Me', () => {       // cross-cutting feature
    test.describe('Functional', () => {      // @smoke + @regression
    test.describe('Security', () => {        // @security
    test.describe('Contract', () => {        // @contract
  });
});
```

## Tags

| Tag            | Purpose               | CI trigger                |
| -------------- | --------------------- | ------------------------- |
| `@smoke`       | Happy path            | Every PR + every push     |
| `@regression`  | Edge + negative       | Push to main + nightly    |
| `@security`    | Auth, IDOR, injection | Push to main + weekly     |
| `@contract`    | API schema validation | Every PR + nightly        |
| `@a11y`        | WCAG 2.1 AA           | Weekly + PRs touching ui/ |
| `@visual`      | Screenshot diff       | Nightly only              |
| `@performance` | Response time SLAs    | Nightly                   |

## CI Branch strategy

| Trigger      | API tests               | UI tests                                    | ~Time   |
| ------------ | ----------------------- | ------------------------------------------- | ------- |
| Pull Request | `@smoke` + `@contract`¹ | `@smoke`                                    | 5–7 min |
| Push to main | Full suite              | `@smoke` + `@regression` + `@security`      | 15 min  |
| Nightly      | Full suite              | Full suite (incl. `@visual` + `@a11y`)      | 30 min  |
| Weekly       | —                       | `@security` + `@a11y` (dedicated workflows) | —       |

¹ `@contract` runs on every PR via the dedicated `contract-tests.yml` workflow (separate from `api-tests.yml`).
`@visual` runs nightly only — requires snapshot baselines committed to git.

## Test data

Both scripts call `POST /testData/seed` — a built-in RWA endpoint that resets the DB to a known state:

```bash
npm run db:seed    # reset DB to seed state (safe to run multiple times)
npm run db:reset   # same as db:seed — use before/after test runs to ensure clean state
```

Run `db:seed` once after a fresh environment setup or when test data gets polluted. Both scripts respect `API_URL` from `.env`. Primary test user after seed: `Heath93` / `s3cret` (Ted Parisian, id: `uBmeaz5pX`).

## Running tests

```bash
npm test                      # all tests
npm run test:ui               # UI only
npm run test:api              # API only
npm run test:smoke            # @smoke
npm run test:regression       # @regression
npm run test:security         # @security
npm run test:contract         # @contract
npm run test:a11y             # @a11y
npm run test:visual           # @visual
npm run test:performance      # @performance
npm run test:staging          # all vs staging
npm run test:production       # all vs production
```

## Import conventions

```typescript
// UI tests (tests/ui/)
import {test, expect} from '../fixtures';
import {createUser} from '../helpers/api-helpers'; // only if test modifies user data
import xssPayloads from '../data/xss-payloads.json'; // for security tests

// API tests (tests/api/)
import {test, expect} from '@playwright/test';
import {createUser, loginAs, createTransaction} from '../helpers/api-helpers';
// import {buildUser} from '../utils/factories'; // only if building request bodies inline
import xssPayloads from '../data/xss-payloads.json';
```

## utils/ vs helpers/ — why two folders

|                     | `utils/`                            | `helpers/`                  |
| ------------------- | ----------------------------------- | --------------------------- |
| Side effects        | No — pure functions                 | Yes — hits the API/network  |
| Example             | `buildUser()`, `buildTransaction()` | `createUser()`, `loginAs()` |
| Runs without server | Yes                                 | No                          |
| Use in              | Both fixtures and tests             | beforeAll / beforeEach      |

## Test isolation

- **Read-only tests**: use shared `storageState` (loaded automatically by playwright.config.ts)
- **Tests that modify user data**: `createUser()` → fresh user per test
- **Mutable resources** (transactions, bank accounts): `beforeEach` create + `afterEach` delete or re-seed
- **User sessions**: `beforeAll` is fine — session cookies don't change within a file

## Visual snapshots

1. First run creates baselines in `__snapshots__/` (always passes)
2. **Commit `__snapshots__/` to git** — CI needs it
3. To update: `npx playwright test --update-snapshots --grep @visual`

## AI agents (9 total)

| Agent                  | Invoked by                          | Writes                                                                    |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| `support-agent`        | `setup-project` / `gen-test` Wave A | fixtures, helpers, global-setup, base.page                                |
| `pom-agent`            | `gen-test` Wave A                   | `tests/pages/<feature>.page.ts` + fixture registration                    |
| `gherkin-agent`        | `gen-test` Wave A                   | `docs/test-cases/<feature>.feature`                                       |
| `ui-test-agent`        | `gen-test` Wave B                   | `tests/ui/<feature>.spec.ts` (all UI categories)                          |
| `api-test-agent`       | `gen-test` Wave B                   | `tests/api/<feature>.spec.ts` (all API categories)                        |
| `ui-debug-agent`       | `start-testing` loop                | fixes failing UI tests or writes test.skip bug report                     |
| `api-debug-agent`      | `start-testing` loop                | fixes failing API tests or writes test.skip bug report                    |
| `exploratory-agent`    | `/exploratory-test`                 | `docs/workflows/app-workflow-map.md` + per-page briefs                    |
| `data-integrity-agent` | `/data-integrity`                   | `tests/helpers/db-helpers.ts`, `tests/api/data-integrity.spec.ts`, report |

## Gen-test flow

```
Wave A (parallel): support-agent + pom-agent + gherkin-agent
        ↓
Wave B (parallel): ui-test-agent + api-test-agent
        ↓
Wave C (sequential): data-integrity-agent
```

## Project-specific learnings

- **[signin]** Formik submit button starts **ENABLED** on page load — `isValid` defaults to `true` before any validation runs (validate-on-change, not validate-on-mount). Never assert `toBeDisabled()` on a Formik button before user interaction.
- **[signin]** Sign Up link DOM detachment: mouse-move to the "Sign Up" link triggers Formik `onBlur` on the Username field, causing a re-render that detaches the link before click fires. Use `toHaveAttribute('href', '/signup')` + `page.goto('/signup')` — never `link.click()` for Formik form navigation links.
- **[signin]** `POST /login` 401 and 400 responses return **plain text** (`"Unauthorized"`), not JSON. Never call `res.json()` on error responses from `/login` — use `res.text()` or only `res.status()`.
- **[signin]** `POST /users` and `POST /login` both expose the **bcrypt password hash** in the response `user.password` field (BUG-003, BUG-004 — known app bugs).
- **[signin]** `POST /users` with missing required fields returns **500 HTML** (Prisma stack trace), not 422 JSON (BUG-001). `POST /users` with a duplicate username also returns 500 HTML, not 409 (BUG-002).
- **[signin]** Tab focus order on `/signin` is broken — Username is NOT the first element focused by Tab (BUG-007 — known app bug).
- **[signin]** axe-core `link-name` violations exist on `/signin` — icon-only links have no accessible name (BUG-006 — known app bug).
- **[all]** Seed user after `npm run db:seed` is **`Heath93` / `s3cret`** (Ted Parisian, id: `uBmeaz5pX`). Never hardcode `PainterJoy90` or other usernames from the original open-source RWA seed — this project uses a custom Prisma seed.
- **[all]** `tsconfig.json` must include `"esModuleInterop": true` and `"resolveJsonModule": true` for JSON imports in tests. The `include` array must cover `tests/**` so `tests/data/*.json` files resolve.
- **[all]** GTS / eslint-plugin-playwright enforcements: use `toBeHidden()` (not `not.toBeVisible()`); no `waitForTimeout()`; no `waitForLoadState('networkidle')` — use `'load'` or `'domcontentloaded'`; single-param arrow functions without parens (`dialog => ...`); `_fieldName` with eslint-disable for unused destructuring vars.
- **[all]** `BasePage.page` is `protected` — test files cannot access it. Always include `page` as a separate fixture param when needing `page.url()`, `page.goto()`, or direct page access.
- **[all]** `page.waitForURL('**/path')` glob can fail with React Router SPA navigation. Use regex: `expect(page).toHaveURL(/path/)`.
- **[all]** Import only what is used — ESLint will error on unused imports from helpers/factories. Do not speculatively import `createUser`, `loginAs`, etc.
- **[all — data-heavy pages]** UI tests for pages that render lists/feeds/counts MUST compare against the API response, not hardcoded values. Use `apiClient` (available in all UI tests via fixtures, points to `API_URL` with shared session). Pattern: `const {results} = await (await apiClient.get('/transactions/public?page=1&limit=10')).json(); expect(await homePage.getTransactionCount()).toBe(results.length)`. This catches bugs like timezone filtering that remove rows the API returned.
- **[all — data-heavy pages]** Full row cross-check pattern for lists: iterate all API results, for each assert `toContainText(tx.senderName)`, `toContainText(tx.receiverName)`, `toContainText((tx.amount / 100).toFixed(2))`, and check like/comment counts via `item.locator('p').filter({hasText: /^\d+$/}).nth(0)`. This catches special-character rendering bugs, encoding issues, and amount formatting bugs without hardcoding any values.
- **[all — data-heavy pages]** Pagination deduplication test: collect IDs from page 1 and page 2 via API, assert zero overlap. Catches pagination off-by-one bugs.
- **[home]** Tab routing: Everyone → `/` (label "Public"), Friends → `/contacts` (label "Contacts"), Mine → `/personal` (label "Personal"). These are not the tab names — the section labels differ.
- **[home]** `homePage.navigate()` calls `transactionList.waitFor({state: 'visible'})` after `goto('/')` — the transaction grid is loaded async from the API and requires this explicit wait.
- **[home]** Notification badge vs sidebar nav link both point to `/notifications`. `getByRole('link', {name: /notifications/i})` matches the WRONG element (sidebar text link, no count). Use the stable hooks: `data-test="nav-top-notifications-link"` (badge link) and `data-test="nav-top-notifications-count"` (count span). Prefer `data-test` attributes whenever role/href is ambiguous — the RWA app exposes them throughout.
- **[home]** `GET /transactions/public?dateStart=...&dateEnd=...` returns **500** (server crash) when date-filter params are passed (BUG-HOME-001 — known app bug). The date-range filter test is `test.skip`-ped in `tests/api/home.spec.ts`.
- **[all]** **Client-side-auth SPAs need a UI login for `storageState`.** The RWA frontend uses an XState auth machine that persists `authState` in `localStorage`. An API-only login (`POST /login`) sets only the session cookie — XState then boots as `"unauthorized"` and redirects every page to `/signin`, hanging all authenticated UI tests. `global-setup.ts` must log in **through the UI** (goto /signin → fill → click Sign In → wait for the grid) so XState commits `authState="authorized"` before `storageState` is saved.
- **[all]** **signin/signup fixtures must clear localStorage, not just cookies — and they are COUPLED to global-setup.** Once `global-setup` logs in through the UI, `storageState` carries `localStorage.authState="authorized"`. `page.context().clearCookies()` alone leaves XState booting `"authorized"`, redirecting `/signin → /` and timing out every signin locator (30s). Fixtures must also run `page.addInitScript(() => window.localStorage.clear())` (see `clearAuthState` in `fixtures.ts`). **The trap:** the bug is invisible while reusing an old API-login `user.json` — it only appears once `storageState` is regenerated. Whenever you change how global-setup writes auth, re-run the signin/signup specs in the SAME run (regenerate storageState first); never trust a prior "all green."
- **[all]** **Page specs use the shared session only — NEVER `browser.newContext()` or a UI login inside a page-spec test body.** A feature/page UI spec tests authenticated content via the shared `storageState`. Creating new contexts or doing in-test logins is slow (30–60s per context) and flaky. Auth-flow tests (login, logout, unauthenticated redirect) belong in the signin/auth spec, which owns the login lifecycle.
- **[all — MUI TextField selector trap]** MUI `<TextField>` puts `data-test` on the outermost wrapper `<div>` (or `<span>` for checkbox), NOT on the `<input>` inside. `getByTestId('signin-username')` returns a div — `.fill()` then waits 30s for the div to become editable and times out. Always verify via `browser_evaluate` which tag owns the `data-test`. Use `locator('#id')` (e.g. `#username`, `#password`) to target the actual input. Confirmed affected: **signin** (`#username`, `#password`; checkbox: `[data-test="signin-remember-me"] input[type="checkbox"]`), **signup** (`#firstName`, `#lastName`, `#username`, `#password`, `#confirmPassword`). Safe to use `getByTestId` directly: `signin-submit` (BUTTON), `signup-submit` (BUTTON), `signup` (A link).
- **[all]** **`testIdAttribute` must be set to `data-test` in `playwright.config.ts`.** Playwright's default `testIdAttribute` is `data-testid` — `page.getByTestId('x')` looks for `[data-testid="x"]`. The RWA app uses `data-test`. Without `testIdAttribute: 'data-test'` in `use:`, `getByTestId` silently matches 0 elements (locator returns empty, assertion fails with "element(s) not found"). Always prefer `locator('[data-test="..."]')` for explicit safety; `getByTestId` is fine once the config is correct.
- **[all]** **`createUser()` returns `{data: UserData, userId: string}` — never `data.id`.** The `UserData` type only has `{firstName, lastName, username, password}`. The created user's id is at the top-level `userId` field, not inside `data`. Always destructure both: `const {data: userData, userId} = await createUser(request)`.
- **[all]** **API Remember Me: server sends `Expires`, NOT `Max-Age`.** `POST /login` with `remember: true` returns `Set-Cookie: connect.sid=...; Path=/; Expires=<date 30 days out>; HttpOnly`. No `Max-Age` attribute is sent. Tests asserting `Max-Age` will always fail. Assert `Expires` instead and parse the date for the 30-day check. Session login (no remember) sends no `Expires` and no `Max-Age`.
- **[all]** **`set-cookie` is a forbidden response header in JavaScript — use `page.context().cookies()` instead.** `page.on('response', res => res.headers()['set-cookie'])` always returns `""` due to browser security. To test persistent vs session cookies, use `await page.context().cookies()` and check `cookie.expires > 0` (persistent) vs `=== -1` (session).
- **[all]** **Contract `beforeAll` must use fresh `APIRequestContext` per login.** Reusing the same `request` fixture across two `/login` calls in `beforeAll` means the second call finds an existing session and the server omits `Set-Cookie`. Use `playwright.request.newContext({baseURL: process.env.API_URL})` for each login, then `await ctx.dispose()` after. Available via `test.beforeAll(async ({playwright}) => {...})`.
- **[all — test ownership pattern]** **Each spec file owns assertions only for its own feature. Navigation to another feature's page stops at URL assertion + the destination page's "ready anchor" (e.g. `transactionPage.transactionDetailHeader`). Content assertions on the destination page belong in the destination spec.** Never use raw `page.locator()` for elements that belong to a different page's POM. When crossing pages, use the destination POM's stable locator as the "landed" signal, then stop. Example: `home.spec.ts` clicks a transaction row → asserts `toHaveURL(/transaction\/id/)` + `transactionPage.transactionDetailHeader.toBeVisible()` → STOP. All sender/receiver/amount/like/comment assertions are in `transaction.spec.ts`. Exception: cross-feature end-to-end flows belong in `tests/e2e/` (not in feature specs). When navigating from Feature A to Feature B's page for a link-works check, import the destination POM class and instantiate it with the same `page`: `import {SignupPage} from '../pages/signup.page'; await expect(new SignupPage(page).submitButton).toBeVisible()`. Locators always live in the POM — never hardcode selectors in test files. If you can't use the fixture (both fixtures auto-navigate and would conflict), instantiate the POM class directly instead.
