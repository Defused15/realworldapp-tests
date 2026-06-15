# realworldapp-tests

Production-grade test suite for the [Cypress Real World App](https://github.com/cypress-io/cypress-realworld-app) — a payment/transactions app used as a reference implementation for testing practices.

## Stack

| Layer          | Tool                           | Purpose                                              |
| -------------- | ------------------------------ | ---------------------------------------------------- |
| E2E / UI       | Playwright                     | Browser automation, visual regression, accessibility |
| API            | Playwright                     | HTTP contract, security, performance                 |
| DB Integration | Vitest + pg                    | SQL cross-checks: API writes vs actual DB rows       |
| Unit           | Vitest                         | Pure factories — fast, mutation-tested               |
| Mutation       | Stryker                        | Proves the unit tests actually catch regressions     |
| Performance    | k6                             | Load/stress/spike; SLOs as CI gate                   |
| Observability  | Prometheus + Grafana           | Live k6 metrics dashboards                           |
| Security       | OWASP ZAP · Trivy · Gitleaks   | Black-box DAST + SCA + secret scanning               |
| Accessibility  | axe-core/playwright            | WCAG 2.1 AA                                          |
| Reporting      | Allure                         | Rich, historical test reports                        |
| Test data      | @faker-js/faker                | Realistic, unique values per test                    |
| Linting        | GTS + eslint-plugin-playwright | Google TypeScript Style, Playwright-specific rules   |

> Full organizing principle, layers, tags and gates: **[docs/test-strategy.md](docs/test-strategy.md)**.
> Decisions behind the architecture: **[docs/adr/](docs/adr/)**.

## Test Pyramid

```
            ▲
           /|\
          / | \        E2E / UI Tests (Playwright)
         /  |  \       tests/ui/*.spec.ts
        /   |   \      Happy path, edge, security, a11y, visual
       /----|----\
      /     |     \    API Tests (Playwright)
     /      |      \   tests/api/*.spec.ts
    /       |       \  Functional, contract, security, performance
   /--------|--------\
  /         |         \ DB Integration Tests (Vitest + pg)
 /          |          \ tests/db-integration/*.test.ts
/           |           \ API write → SQL read, orphan checks, schema constraints
```

**Why three layers?**

- **UI tests** catch rendering bugs, navigation flows, and accessibility issues.
- **API tests** catch contract regressions and auth/security holes.
- **DB integration tests** break the API-round-trip circularity — if both the write and read endpoints share the same bug, an API test misses it. A SQL cross-check doesn't.

## Prerequisites

The app runs in Docker with PostgreSQL. Before running any tests:

```bash
docker compose up -d      # start app + DB
npm run db:seed           # reset DB to known seed state
```

The app exposes:

- `http://localhost:3000` — UI
- `http://localhost:3001` — API

Primary seed user: **Heath93 / s3cret** (Ted Parisian, id: `uBmeaz5pX`)

## Project Structure

```
tests/
  ui/
    signin.spec.ts          ← all UI tests for signin
    signup.spec.ts          ← all UI tests for signup
    home.spec.ts            ← all UI tests for home feed
    transaction.spec.ts     ← all UI tests for transaction detail
  api/
    signin.spec.ts          ← all API tests for signin/auth
    signup.spec.ts          ← all API tests for signup/users
    home.spec.ts            ← all API tests for feeds + notifications
    transaction.spec.ts     ← all API tests for transactions, likes, comments
  db-integration/           ← Vitest + pg (NOT Playwright)
    signup.test.ts          ← user writes, bcrypt, unique constraint
    signin.test.ts          ← API response vs DB row, modifiedAt unchanged
    home.test.ts            ← feed IDs exist in DB, isRead consistency
    transaction.test.ts     ← write-then-SQL, orphan checks, schema validation
    helpers.ts              ← loginAs(), createFreshUser() — fetch-based, no Playwright
  pages/
    base.page.ts            ← abstract base with shared nav locators
    signin.page.ts
    signup.page.ts
    home.page.ts
    transaction.page.ts
  fixtures/
    fixtures.ts             ← test.extend() with page fixtures + auth state
    index.ts                ← re-exports test and expect
  helpers/
    api-helpers.ts          ← Playwright-context helpers: loginAs(), createUser()
    db-helpers.ts           ← pg Pool: queryOne(), queryMany(), queryCount(), queryScalar()
  utils/
    factories.ts            ← pure functions, no side effects: buildUser()
  data/
    xss-payloads.json       ← attack strings for security tests
    seed-users.json         ← known users after db:seed
  scripts/
    seed.ts                 ← POST /testData/seed — reset DB to baseline
    teardown.ts             ← POST /testData/seed — same as seed
  global-setup.ts           ← UI login once before all Playwright UI tests

docs/
  test-cases/               ← Gherkin .feature files (human-readable scenarios)
  bug-reports/              ← structured bug reports for known app issues
  workflows/                ← app workflow maps (generated by exploratory-agent)
```

## Running Tests

### DB Integration (Vitest — fastest, no browser)

```bash
npm run db:seed        # always seed before running
npm run test:db        # run all db-integration tests once
npm run test:db:watch  # watch mode during development
```

### API Tests (Playwright — no browser)

```bash
npm run test:api

# by tag
npm run test:smoke
npm run test:contract
npm run test:security
npm run test:performance
```

### UI Tests (Playwright — headed browser)

```bash
npm run test:ui

# by tag
npm run test:smoke
npm run test:a11y
npm run test:visual
npm run test:regression
```

### Full suite

```bash
npm run test:all   # db-integration → Playwright (all layers)
npm test           # Playwright only (UI + API)
```

### Visual snapshots

Visual baseline snapshots live in `__snapshots__/` and are committed to git.

```bash
# Create baselines (first run always passes)
npx playwright test --update-snapshots --grep @visual

# Commit the baselines
git add __snapshots__/
git commit -m "chore: update visual snapshots"
```

## CI Strategy — sequential gates

`.github/workflows/pipeline.yml` runs gates fail-fast, cheap → expensive. A
broken gate stops the ones after it.

```
quality ──┬─ security-sca (SCA + secrets — no app needed)
          └─ contract → api → db → ui → performance → zap → report
```

| Trigger      | What runs                                                            |
| ------------ | -------------------------------------------------------------------- |
| Pull Request | quality, security-sca, then gates 1–4 at reduced scope (`@smoke`)    |
| Push to main | quality, security-sca, all gates full scope                          |
| Nightly      | full suite incl. `@visual`/`@a11y`, cross-browser, perf stress/spike |

App-dependent gates are guarded by `vars.APP_IMAGE` (booting the app in CI is
the one deferred piece — see `BACKLOG.md` and ADR-0003). Until configured,
`quality` + `security-sca` run green and the rest are skipped. See
[docs/adr/0003-sequential-ci-gates.md](docs/adr/0003-sequential-ci-gates.md).

## Architecture Decisions

> Formal records live in **[docs/adr/](docs/adr/)**. The notes below are the
> quick rationale.

### Why Vitest for DB integration, not Playwright?

Playwright's `request` fixture carries session state and runs inside a browser context — that's appropriate for testing the API as a user would call it. But DB integration tests need direct database access (`pg.Pool`) and no browser overhead. Vitest runs as a pure Node.js process, connects directly to PostgreSQL, and executes 40+ SQL assertions in under 5 seconds.

### Why pg instead of docker exec psql?

`docker exec psql` is a shell subprocess: slow, container-name-fragile, no parameterized queries (SQL injection risk in test code), and returns raw text that must be parsed back from JSON. `pg.Pool` connects natively — typed rows, `$1/$2` placeholders, real error objects, and 10× faster.

### Why parameterized queries?

Even in test code, string interpolation in SQL is a bad habit. Parameterized queries (`WHERE id = $1`) protect against accidental injection when test data contains special characters (e.g., the XSS payload `'; DROP TABLE users--`).

### One file per feature per layer

```
tests/ui/signin.spec.ts          ← Playwright UI
tests/api/signin.spec.ts         ← Playwright API
tests/db-integration/signin.test.ts  ← Vitest + pg
```

Each file owns assertions for its feature only. Cross-feature navigation stops at a URL assertion + the destination page's POM ready anchor — content assertions belong in the destination spec.

### Page Object Model

All locators live in `tests/pages/*.page.ts`. Test files never contain raw CSS or attribute selectors. When a test needs a locator from another page's POM (e.g., to assert a link navigates correctly), it imports the destination POM class and instantiates it directly:

```typescript
import {SignupPage} from '../pages/signup.page';
await expect(new SignupPage(page).submitButton).toBeVisible();
```

## Adding Tests for a New Feature

Use the `/gen-test` skill — it scans the live page and orchestrates 5 agents in 3 waves:

```
Wave A (parallel): pom-agent + support-agent + gherkin-agent
        ↓
Wave B (parallel): ui-test-agent + api-test-agent
        ↓
Wave C:            data-integrity-agent  → tests/db-integration/<feature>.test.ts
```

```bash
# Example
/gen-test bank-accounts on http://localhost:3000/bankaccounts
```

To add DB integration tests for an existing feature:

```bash
/data-integrity bank-accounts
```

## Environment Variables

Defined in `.env` (not committed):

```
BASE_URL=http://localhost:3000
API_URL=http://localhost:3001
TEST_USER_USERNAME=Heath93
TEST_USER_PASSWORD=s3cret
```

DB connection for `tests/db-integration/` is configured in `vitest.config.ts` and defaults to `localhost:5432/rwa_dev` (user: `postgres`, no password) — matching the Docker Compose setup.

## Known App Bugs

Documented in `docs/bug-reports/`. Tests that hit known bugs either assert the current (broken) behavior or are `test.skip`-ped with a structured comment.

| ID                 | Endpoint                 | Issue                                                     |
| ------------------ | ------------------------ | --------------------------------------------------------- |
| BUG-001            | POST /users              | Missing fields → 500 HTML, not 422                        |
| BUG-002            | POST /users              | Duplicate username → 500 HTML, not 409                    |
| BUG-003            | POST /users              | Response leaks bcrypt hash in `user.password`             |
| BUG-004            | POST /login              | Response leaks bcrypt hash in `user.password`             |
| BUG-006            | /signin                  | Icon-only links have no accessible name (axe-core)        |
| BUG-007            | /signin                  | Tab focus order broken — username not first               |
| BUG-HOME-001       | GET /transactions/public | Date filter params cause 500 crash                        |
| BUG-TXN-SCHEMA-001 | transactions.amount      | Stored as `double precision`, should be `integer` (cents) |
