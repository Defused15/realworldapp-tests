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

Each spec file contains all test categories organized in `test.describe` blocks:

```typescript
// tests/ui/signin.spec.ts
test.describe('signin', () => {
  test.describe('Happy Path', () => {    // @smoke
  test.describe('Edge Cases', () => {    // @regression
  test.describe('Security', () => {      // @security
  test.describe('Accessibility', () => { // @a11y
  test.describe('Visual', () => {        // @visual
});

// tests/api/signin.spec.ts
test.describe('signin API', () => {
  test.describe('Functional', () => {    // @smoke + @regression
  test.describe('Security', () => {      // @security
  test.describe('Contract', () => {      // @contract
  test.describe('Performance', () => {   // @performance
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

## AI agents (7 total)

| Agent             | Invoked by                                          | Writes                                                 |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `support-agent`   | `setup-project` (full) / `gen-test` Wave A (update) | fixtures, helpers, global-setup, base.page             |
| `pom-agent`       | `gen-test` Wave A                                   | `tests/pages/<feature>.page.ts` + fixture registration |
| `gherkin-agent`   | `gen-test` Wave A                                   | `docs/test-cases/<feature>.feature`                    |
| `ui-test-agent`   | `gen-test` Wave B                                   | `tests/ui/<feature>.spec.ts` (all UI categories)       |
| `api-test-agent`  | `gen-test` Wave B                                   | `tests/api/<feature>.spec.ts` (all API categories)     |
| `ui-debug-agent`  | `start-testing` loop                                | fixes failing UI tests or writes test.skip bug report  |
| `api-debug-agent` | `start-testing` loop                                | fixes failing API tests or writes test.skip bug report |

## Gen-test flow

```
Wave A (parallel): support-agent + pom-agent + gherkin-agent
        ↓
Wave B (parallel): ui-test-agent + api-test-agent
```
