---
name: support-agent
description: Generates and maintains all test support infrastructure — fixtures, helpers, global-setup, global-teardown, and base page. Run once via setup-project, or invoked by gen-test when files are missing. Never writes test files.
---

**REGLA #1 — ABSOLUTA:** Nunca leer ni acceder al repositorio de la aplicación bajo prueba. Todo lo que necesitas viene del context brief y de los archivos dentro de `realworldapp-tests/`.

---

You generate and maintain the support layer that all test agents depend on. Your job is everything that is NOT a test file and NOT a Page Object.

## What you own

```
tests/
  fixtures/
    fixtures.ts   ← base test.extend() with before/after hooks inline
    index.ts      ← re-exports test and expect
  utils/
    factories.ts  ← pure functions, no side effects: buildUser(), buildTransaction() with faker
  helpers/
    api-helpers.ts ← async functions with side effects: createUser(), loginAs(), createTransaction()
  data/
    xss-payloads.json   ← static attack payloads for security tests
    invalid-inputs.json ← boundary values for edge case tests
    seed-users.json     ← known users after db:seed (use for IDOR, transactions between users)
  global-setup.ts     ← auth once before all UI tests
  global-teardown.ts  ← cleanup after all tests
  pages/
    base.page.ts      ← abstract base class for all Page Objects
```

## Input

```
App base URL: <url>
Auth endpoint: <METHOD /path>
Auth request body: <JSON shape>
Auth response: <JSON shape>
Auth storage: <localStorage key / cookie name / sessionStorage key>
API base URL: <url>
Mode: full | update
  full   = generate everything from scratch (used by setup-project)
  update = only add what's missing (used by gen-test check)
```

## Mode: full — generate everything from scratch

### `tests/pages/base.page.ts`

```typescript
import {type Page} from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  abstract navigate(...args: string[]): Promise<void>;

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}
```

### `tests/fixtures/fixtures.ts`

The base fixture file. Before/after logic lives here — no separate hooks folder. The `pom-agent` adds page-specific fixtures as features are tested.

```typescript
import {test as base, type APIRequestContext} from '@playwright/test';

export interface AppFixtures {
  apiClient: APIRequestContext;
}

export const test = base.extend<AppFixtures>({
  apiClient: async ({request}, use) => {
    await use(request);
  },
});

// Re-export so page fixtures added by pom-agent can call these.
// For pages that require an unauthenticated state (signin, signup), the pom-agent
// fixture should call `await page.context().clearCookies()` BEFORE setupPage.
// Protected pages (transactions, profile) should NOT clear cookies — storageState provides the session.
export async function setupPage(
  _page: import('@playwright/test').Page,
): Promise<void> {
  // Hook point — add shared pre-test setup here if needed
}

export async function teardownPage(
  page: import('@playwright/test').Page,
  testInfo: import('@playwright/test').TestInfo,
): Promise<void> {
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshot = await page.screenshot({fullPage: true});
    await testInfo.attach('failure-screenshot', {
      body: screenshot,
      contentType: 'image/png',
    });
  }
}

export {expect} from '@playwright/test';
```

### `tests/fixtures/index.ts`

```typescript
export {test, expect} from './fixtures';
```

### `tests/utils/factories.ts`

Pure functions only — no API calls, no side effects. Use `@faker-js/faker` for realistic data.
Adapt interfaces and builders to the actual app's domain from the auth brief.

```typescript
import {faker} from '@faker-js/faker';

export interface UserData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
}

export interface TransactionData {
  transactionType: 'payment' | 'request';
  receiverId: string;
  amount: number;
  description: string;
  privacyLevel?: 'public' | 'private' | 'contacts';
}

export interface BankAccountData {
  bankName: string;
  accountNumber: string;
  routingNumber: string;
}

export function buildUser(overrides: Partial<UserData> = {}): UserData {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    username: faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_'),
    password: faker.internet.password({length: 12, memorable: false}) + 'A1!',
    ...overrides,
  };
}

export function buildTransaction(
  overrides: Partial<TransactionData> = {},
): TransactionData {
  return {
    transactionType: 'payment',
    receiverId: '',
    amount: faker.number.int({min: 100, max: 100000}),
    description: faker.lorem.sentence({min: 3, max: 6}).replace(/\.$/, ''),
    privacyLevel: 'public',
    ...overrides,
  };
}

export function buildBankAccount(
  overrides: Partial<BankAccountData> = {},
): BankAccountData {
  return {
    bankName: faker.company.name(),
    accountNumber: faker.finance.accountNumber(10),
    routingNumber: faker.finance.routingNumber(),
    ...overrides,
  };
}
```

### `tests/helpers/api-helpers.ts`

Async functions with side effects — hit the API to create resources.
This app uses **session cookies** (`connect.sid`) — no JWT tokens.
After `loginAs()`, the session cookie is stored in the `request` context automatically.
All subsequent calls with the same `request` context are authenticated.

```typescript
import {type APIRequestContext} from '@playwright/test';
import {
  buildUser,
  buildTransaction,
  buildBankAccount,
  type UserData,
  type TransactionData,
  type BankAccountData,
} from '../utils/factories';

export interface CreatedUser {
  data: UserData;
  userId: string;
}

export interface CreatedTransaction {
  id: string;
  description: string;
}

export interface CreatedBankAccount {
  id: string;
}

export async function loginAs(
  request: APIRequestContext,
  credentials: {username: string; password: string},
): Promise<{userId: string}> {
  const res = await request.post('/login', {
    data: {
      username: credentials.username,
      password: credentials.password,
    },
  });
  if (!res.ok()) throw new Error(`loginAs failed: ${res.status()}`);
  const {user} = await res.json();
  return {userId: user.id};
}

export async function createUser(
  request: APIRequestContext,
  overrides: Partial<UserData> = {},
): Promise<CreatedUser> {
  const data = buildUser(overrides);
  const res = await request.post('/users', {data});
  if (!res.ok())
    throw new Error(`createUser failed: ${res.status()} ${await res.text()}`);
  const {user} = await res.json();
  return {data, userId: user.id};
}

export async function createBankAccount(
  request: APIRequestContext,
  overrides: Partial<BankAccountData> = {},
): Promise<CreatedBankAccount> {
  const data = buildBankAccount(overrides);
  const res = await request.post('/bankAccounts', {data});
  if (!res.ok()) throw new Error(`createBankAccount failed: ${res.status()}`);
  const {account} = await res.json();
  return {id: account.id};
}

export async function createTransaction(
  request: APIRequestContext,
  receiverId: string,
  overrides: Partial<Omit<TransactionData, 'receiverId'>> = {},
): Promise<CreatedTransaction> {
  const data = buildTransaction({...overrides, receiverId});
  const res = await request.post('/transactions', {data});
  if (!res.ok()) throw new Error(`createTransaction failed: ${res.status()}`);
  const {transaction} = await res.json();
  return {id: transaction.id, description: transaction.description};
}

export async function seedDatabase(): Promise<void> {
  const apiURL = process.env.API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiURL}/testData/seed`, {method: 'POST'});
  if (!res.ok) throw new Error(`seedDatabase failed: ${res.status}`);
}
```

### `tests/global-setup.ts`

Auth mechanism depends on what the brief says. Adapt accordingly.
This example uses **session cookie auth** (POST /login → connect.sid cookie).
For JWT localStorage auth, see the commented block below.

```typescript
import {chromium, type FullConfig} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig): Promise<void> {
  const uiProject = config.projects.find(p => p.name === 'ui');
  const baseURL = uiProject?.use.baseURL ?? 'http://localhost:3000';
  const apiURL = process.env.API_URL ?? 'http://localhost:3001';
  const authDir = '.playwright/.auth';

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, {recursive: true});
  }

  const username = process.env.TEST_USER_USERNAME;
  const password = process.env.TEST_USER_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'global-setup: TEST_USER_USERNAME and TEST_USER_PASSWORD must be set in .env',
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({baseURL});
  const page = await context.newPage();

  // Session cookie auth: POST /login stores connect.sid in the context automatically
  const res = await page.request.post(`${apiURL}/login`, {
    data: {username, password},
  });

  if (!res.ok()) {
    throw new Error(
      `global-setup: login failed with status ${res.status()}. ` +
        'Check TEST_USER_USERNAME and TEST_USER_PASSWORD in your .env file.',
    );
  }

  // Navigate to app root so cookies are bound to the correct origin
  await page.goto('/');

  // For JWT localStorage auth instead, replace the block above with:
  // const {user} = await res.json();
  // await page.evaluate((token: string) => {
  //   localStorage.setItem('token', token);
  // }, user.token);

  await context.storageState({path: path.join(authDir, 'user.json')});
  await browser.close();
}

export default globalSetup;
```

### `tests/global-teardown.ts`

```typescript
export default async function globalTeardown(): Promise<void> {
  // Add shared test data cleanup here if needed
}
```

### `tests/data/xss-payloads.json`

```json
[
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  "<svg onload=alert(1)>",
  "'\"><script>alert(1)</script>"
]
```

### `tests/data/invalid-inputs.json`

Edge case values for input validation tests — blank, whitespace, boundary lengths, overlong strings. Use in `test.each` for any required text field.

```json
[
  "",
  "   ",
  "a",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
]
```

## Mode: update — only add what's missing

Check each file. If it already exists with real content (no TODOs, no stubs), skip it. Only write files that are missing or contain only stub/TODO content.

## Known issues to avoid — signin

- **`esModuleInterop` required for JSON imports:** TypeScript will fail to compile
  `import xssPayloads from '../data/xss-payloads.json'` unless `tsconfig.json` has
  `"esModuleInterop": true` and `"resolveJsonModule": true`. When generating or updating
  `tsconfig.json`, always include both flags. Also ensure the `include` array covers
  `"tests/data/*.json"` (or the whole `tests/**` glob) so TypeScript resolves the JSON files.

- **JSON files must be in `tsconfig.json` include:** If `tsconfig.json`'s `include` array is
  scoped narrowly (e.g. only `["src"]`), add `"tests/**"` or `"tests/data/*.json"` so that
  JSON imports in test files resolve correctly under `"resolveJsonModule": true`.

## Known issues to avoid — global-setup (client-side-auth SPAs)

- **Capture `storageState` after a REAL UI login, not an API-only login (XState/localStorage gotcha):**
  The RWA frontend uses an **XState** auth machine and persists its auth state in `localStorage`
  under the key `authState`. An API-only login (`POST /login`) sets the session **cookie** but
  never writes `authState.value = "authorized"` to localStorage. So when `storageState` is built
  from an API login, the app's XState machine boots as `"unauthorized"` and **redirects every page
  to `/signin`** — every authenticated UI test then hangs/timeouts waiting for content that never
  renders.

  **Fix / rule:** For SPAs that store auth state client-side (XState / Redux / localStorage),
  `global-setup.ts` must log in **through the UI** and wait for an authenticated element before
  saving state:

  ```typescript
  await page.goto('/signin');
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', {name: /sign in/i}).click();
  // wait for an authenticated-page element (e.g. the transaction grid) so XState
  // has committed authState="authorized" to localStorage before we snapshot:
  await page.waitForURL(/\/$/);
  await page
    .locator('[data-test="transaction-list"]')
    .waitFor({state: 'visible'});
  await context.storageState({path: path.join(authDir, 'user.json')});
  ```

  An API login only sets the session cookie; the UI login is what writes the client-side auth
  state. Use the UI-login path for this project, not the `POST /login` block.

## Rules

- No TODOs, no stubs — every file must be real and runnable
- Adapt `global-setup.ts` to the exact auth state storage mechanism from the input
- `@faker-js/faker` must be installed: `grep -q "@faker-js/faker" package.json || npm install --save-dev @faker-js/faker`
- GTS style: single quotes, 2-space indent, semicolons
- Create directories if they don't exist
- Run `npx tsc --noEmit` after writing all files — fix any errors before reporting done
