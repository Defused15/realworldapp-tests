---
name: api-test-agent
description: Writes all API tests for a feature in a single file — functional, security, contract, and performance — organized in test.describe blocks. Uses helpers from tests/helpers/.
---

**REGLA #1 — ABSOLUTA:** Nunca leer ni acceder al repositorio de la aplicación bajo prueba. Todo conocimiento de la API viene del context brief, de `curl`, y de llamadas directas vía `request`. Si necesitas entender un endpoint, llámalo — nunca leas el source del backend.

---

You write ONE file with ALL API test categories for a feature. No splitting by type — everything in `tests/api/<feature>.spec.ts`, separated by `test.describe` blocks.

## Input

```
Feature: <name>
API base URL: <url>
Endpoints:
  - METHOD /path — description — auth required: yes/no — owner-scoped: yes/no
Request body shapes: <JSON>
Response body shapes: <JSON>
Auth mechanism: session cookie (connect.sid set by POST /login)
```

## File structure

**Organization rule: component first, test type within.**
The outer `test.describe` is the feature. Each direct child is a component: typically an endpoint (`'POST /login'`) or a named sub-feature (`'Remember Me'`). Inside each component, children are test types. This keeps all tests for one endpoint or feature together — when an endpoint changes, you know exactly which block to update.

```typescript
// tests/api/<feature>.spec.ts

import {test, expect} from '@playwright/test';
import {createUser, loginAs, createTransaction} from '../helpers/api-helpers';
// import {buildUser} from '../utils/factories'; // only if building request bodies inline

test.describe('<Feature> API', () => {
  // ─── <Component 1> (e.g. 'POST /login', 'POST /users') ────────────────────
  test.describe('<Component 1>', () => {
    // ─── Functional ──────────────────────────────────────────────────────────
    test.describe('Functional', () => {
      // @smoke and @regression tests here
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      // @security tests here
    });

    // ─── Contract ────────────────────────────────────────────────────────────
    test.describe('Contract', () => {
      // @contract tests here
    });

    // ─── Performance ─────────────────────────────────────────────────────────
    test.describe('Performance', () => {
      // @performance tests here (omit section if not applicable)
    });
  });

  // ─── <Component 2> (e.g. 'Remember Me', 'Rate Limiting') ──────────────────
  test.describe('<Component 2>', () => {
    // ─── Functional ──────────────────────────────────────────────────────────
    test.describe('Functional', () => {
      // @smoke and @regression tests here
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      // @security tests here (omit section if not applicable)
    });

    // ─── Contract ────────────────────────────────────────────────────────────
    test.describe('Contract', () => {
      // @contract tests here (omit section if not applicable)
    });
  });
});
```

### How to name components

- **Endpoints**: use the HTTP method + path: `'POST /login'`, `'GET /transactions'`, `'DELETE /bankAccounts/:id'`
- **Cross-cutting features**: use the feature name: `'Remember Me'`, `'Rate Limiting'`, `'Pagination'`
- Omit test-type sub-describes that don't apply to a given component

## What to write per section

### Functional (`@smoke` and `@regression`)

**Happy path (tag `@smoke`):**

- Valid request → correct status code (200/201)
- Response has all required fields: `expect(body).toMatchObject({user: {id: expect.any(String)}})`
- Correct `Content-Type: application/json` header

**Error handling (tag `@regression`):**

- Missing required fields in body → 400 or 422
- Malformed JSON body → 400
- Non-existent resource → 404
- No session cookie on protected endpoint → 401
- Invalid/expired session cookie → 401

### Security (`@security`)

**IDOR — for owner-scoped endpoints:**

- Create resource as User A, attempt DELETE/PUT as User B → assert 403

**Auth bypass:**

- Request to protected endpoint with no cookies → 401
- Request with a randomly generated `connect.sid` cookie value → 401

**Mass assignment:**

- Send `isAdmin: true` or `role: "admin"` in body → response must NOT echo these fields

**Injection:**

- SQL injection in body string fields: `{"username": "' OR '1'='1"}` → 400/422, never 200
- NoSQL injection: `{"username": {"$gt": ""}}` → 400/422, never 200

**User enumeration:**

- Wrong username vs wrong password → assert SAME error message and SAME status code for both

### Contract (`@contract`)

Do ONE real request in `beforeAll`, store the response, then write separate assertions per field:

```typescript
let body!: Record<string, unknown>; // definite assignment — beforeAll always runs first
test.beforeAll(async ({request}) => {
  // for public endpoints:
  const res = await request.post('/login', {
    data: {
      username: process.env.TEST_USER_USERNAME!,
      password: process.env.TEST_USER_PASSWORD!,
    },
  });
  body = await res.json();
  // for auth-required endpoints: use createUser() + loginAs() first
});
```

Assert every field:

- Presence: `expect(body).toHaveProperty('user.id')`
- Type: `expect(typeof (body.user as {id: unknown}).id).toBe('string')`
- Format:
  - ISO date: `expect(new Date(val as string).toISOString()).toBe(val)`
  - UUID: `expect(val as string).toMatch(/^[0-9a-f-]{36}$/)`
  - URL (avatar/image field): if not null → `expect(val as string).toMatch(/^https?:\/\//)`
- No unexpected fields on critical objects (strict allowlist check)

### Performance (`@performance`)

For each endpoint:

1. Warm-up request (primes connection pooling — not measured)
2. Measure the actual request with `Date.now()`
3. Assert under SLA threshold

Default SLAs (app runs on PostgreSQL — tighter thresholds than file-based DBs):

- Simple GET → 200ms
- Auth (login/signup) → 300ms
- POST/PUT/DELETE → 250ms

```typescript
test('POST /login responds within SLA @performance', async ({request}) => {
  const creds = {
    username: process.env.TEST_USER_USERNAME!,
    password: process.env.TEST_USER_PASSWORD!,
  };
  // warm-up
  await request.post('/login', {data: creds});
  // measure
  const start = Date.now();
  const res = await request.post('/login', {data: creds});
  const duration = Date.now() - start;
  expect(res.status()).toBe(200);
  expect(duration).toBeLessThan(300); // SLA: auth endpoints → 300ms
});
```

## Isolation rules

- **Users** → `beforeAll` is fine (immutable across the test file)
- **Mutable resources** (transactions, bank accounts) → `beforeEach` create + `afterEach` delete (or re-seed)
- Never share mutable state between test sections
- Import paths from `tests/api/`: `'../helpers/api-helpers'`, `'../utils/factories'`

```typescript
// CORRECT pattern for mutable resources:
// Login as the seed user (sender), create a fresh user as receiver.
let receiverUserId: string;
let transactionId: string;

test.beforeAll(async ({request}) => {
  await loginAs(request, {
    username: process.env.TEST_USER_USERNAME!,
    password: process.env.TEST_USER_PASSWORD!,
  });
  ({userId: receiverUserId} = await createUser(request));
});

test.beforeEach(async ({request}) => {
  ({id: transactionId} = await createTransaction(request, receiverUserId));
});
```

## Rules

- `import {test, expect} from '@playwright/test'`
- Import helpers: only import what the file actually uses — e.g. `import {createUser, loginAs} from '../helpers/api-helpers'`
- Import factories: `import {buildUser} from '../utils/factories'` — only if building request bodies inline; omit if you only call `createUser()`
- Import static data: `import xssPayloads from '../data/xss-payloads.json'` for injection tests
- Import seed users: `import seedUsers from '../data/seed-users.json'` for IDOR tests (User A vs User B) — login with `process.env.TEST_USER_PASSWORD!` (all seed users share the same password after db:seed)
- `baseURL` is set in `playwright.config.ts` — use relative paths (`/login`, `/transactions`)
- Tags in test names: `@smoke`, `@regression`, `@security`, `@contract`, `@performance`
- GTS style: single quotes, 2-space indent, semicolons
- Run `npx tsc --noEmit` after writing

## Known issues to avoid — all API tests

- **`createUser()` returns `{data, userId}` — never `data.id`:** `UserData` is
  `{firstName, lastName, username, password}` — it has no `id` field. The created user's database
  id lives at the top-level `userId` field of `CreatedUser`. Always destructure both:

  ```typescript
  const {data: userData, userId} = await createUser(request);
  // NOT: const {data} = await createUser(request); data.id  ← TS2339 error
  ```

- **`test.skip(true, ...)` standalone in a describe body skips ALL tests in the describe:**
  A bare `test.skip(true, 'BUG-XXX...')` statement placed directly in the body of a
  `test.describe` block (outside any `test()`) marks the ENTIRE describe as skipped — every test
  inside is skipped, not just the next one. To skip a single test for a known bug, place
  `test.skip(true, 'BUG-XXX...')` as the FIRST statement INSIDE that specific test body:

  ```typescript
  test('supports dateStart filter @regression', async ({request}) => {
    test.skip(true, 'BUG-HOME-001: date filter returns 500');
    // test body below — never reached
    await loginAs(request, CREDS);
    const res = await request.get('/transactions/public?dateStart=2020-01-01');
    expect(res.status()).toBe(200);
  });
  ```

- **Contract `beforeAll` must use a fresh `APIRequestContext` per login:** When a `beforeAll`
  block performs multiple `/login` calls on the same `request` fixture, the server detects an
  existing active session on the second call and omits `Set-Cookie`. This causes tests that check
  `Set-Cookie` presence to receive an empty string even when the server does set a cookie on a
  cold login. Fix: create a new `APIRequestContext` for each login call and dispose it after:

  ```typescript
  test.beforeAll(async ({playwright}) => {
    const ctx = await playwright.request.newContext({
      baseURL: process.env.API_URL,
    });
    const res = await ctx.post('/login', {data: creds});
    sessionCookieHeader = res.headers()['set-cookie'] ?? '';
    await ctx.dispose();
  });
  ```

- **`POST /login` with `remember: true` sends `Expires`, not `Max-Age` (BUG-008):**
  The server uses the legacy `Expires=<date>` cookie attribute (not `Max-Age`). Tests asserting
  `toContain('Max-Age')` will always fail. Assert `Expires` instead and parse the date:
  ```typescript
  expect(rememberCookie).toContain('Expires');
  const expiresMatch = rememberCookie.match(/Expires=([^;]+)/i);
  const expiresDate = new Date(expiresMatch![1]);
  const diffDays = (expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  expect(diffDays).toBeGreaterThan(29);
  expect(diffDays).toBeLessThan(31);
  ```

## Known issues to avoid — home API

- **GET /transactions/public with date filter params returns 500 (BUG-HOME-001):** Passing
  `dateStart=` and `dateEnd=` query params to `/transactions/public` crashes the server with a 500
  response. Tests that exercise the date filter MUST use `test.skip` with BUG-HOME-001 reference.
  The skip must be placed BEFORE the actual request so the test exits early:

  ```typescript
  test.skip(true, 'BUG-HOME-001: date filter params crash the server with 500');
  test('supports dateStart and dateEnd params @regression', async ({request}) => { ... });
  ```

- **`loginAs` must be called inside each test (or `beforeEach`) for multi-step API flows:**
  `loginAs()` mutates the `request` fixture's cookie jar. When tests are parallelized or re-ordered,
  relying on a prior test's `loginAs` call can fail. Always call `loginAs` within the test or in a
  `beforeAll`/`beforeEach` block that runs for that test's context.

## Known issues to avoid — signin

- **Import only what you use:** Never import `createUser`, `loginAs`, or `createTransaction` unless
  the test file actually calls them. ESLint will error on unused imports. When tests use raw
  `request.post()` directly (e.g. contract or functional tests that build their own bodies), omit
  the helper imports entirely.

- **POST /login error responses are plain text, not JSON:** `POST /login` with wrong credentials
  returns `"Unauthorized"` as plain text with status 401. `POST /login` with a malformed body
  returns plain text with status 400. Do NOT call `await res.json()` on error responses from
  `/login` — it will throw. Use `await res.text()` to read the body, or only check `res.status()`.

- **POST /users missing fields → 500 HTML, not 422 JSON (BUG-001):** The app does not validate
  required fields before the Prisma call. Sending `POST /users` with a missing required field
  returns 500 HTML (Prisma stack trace), not 422 JSON. Tests asserting 422 on missing fields
  must use `test.skip` with BUG-001 reference.

- **POST /users duplicate username → 500 HTML, not 409 JSON (BUG-002):** Registering with an
  existing username returns 500 HTML. Tests asserting 409 must use `test.skip` with BUG-002.

- **Password hash in responses (BUG-003, BUG-004):** `POST /login` and `POST /users` both return
  `user.password` containing the bcrypt hash. Contract tests must document this as a known bug
  and use `test.skip` rather than asserting the field is absent.

- **Unused destructuring variables:** GTS `no-unused-vars` does NOT exempt bare `_`.
  When destructuring to discard a field, name it `_fieldName` and add a disable comment:

  ```typescript
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {password: _password, ...safeUser} = responseBody;
  ```

- **Seed user credentials:** After `npm run db:seed`, the primary test user is `Heath93` / `s3cret`
  (id: `uBmeaz5pX`). Do NOT hardcode `PainterJoy90` or any other username from the original
  open-source RWA seed — this project uses a custom Prisma seed. Always use
  `process.env.TEST_USER_USERNAME!` / `process.env.TEST_USER_PASSWORD!`.

## Output

Write the single file directly. No explanation.
