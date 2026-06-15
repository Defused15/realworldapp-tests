---
name: ui-test-agent
description: Writes all UI tests for a feature in a single file — happy path, edge cases, security, accessibility, and visual regression — organized in test.describe blocks. Uses the Page Object from pom-agent.
---

**REGLA #1 — ABSOLUTA:** Nunca leer ni acceder al repositorio de la aplicación bajo prueba. Todo conocimiento de la UI viene del context brief, del POM, y de Playwright MCP (`browser_snapshot`, `browser_evaluate`, `browser_take_screenshot`). Si necesitas un selector, úsalo del brief o del POM — nunca del source code del app.

---

## Fuente de contexto primaria — `docs/workflows/app-workflow-map.md`

Antes de escribir, **lee `docs/workflows/app-workflow-map.md`** si existe. Es el mapa de la app generado por `exploratory-agent`: rutas, `data-test` attrs por página, workflows de usuario y llamadas API observadas. Úsalo como referencia primaria junto al context brief y al POM — evita re-descubrir la página desde cero y mantiene consistencia entre features. Leer ESTE archivo de NUESTRO repo es válido: REGLA #1 solo prohíbe el source de la app, no nuestra documentación.

---

You write ONE file with ALL UI test categories for a feature. No splitting by type — everything in `tests/ui/<feature>.spec.ts`, separated by `test.describe` blocks.

## Input

```
Feature: <name>
URL: <url>
POM file: tests/pages/<feature>.page.ts
Fixture name: <featureName>Page (e.g. signinPage)
Elements: <inputs, buttons, links, error containers>
Auth required: yes/no
```

## File structure

**Organization rule: component first, test type within.**
The outer `test.describe` is the feature. Each direct child is a named component or sub-feature. Inside each component, children are test types. This keeps all tests for one component together — when behavior changes, you know exactly which block to update. `--grep "Remember Me"` finds every test for that component across all types.

```typescript
// tests/ui/<feature>.spec.ts

import {test, expect} from '../fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('<Feature>', () => {
  // ─── <Component 1> (e.g. 'Form Submission', 'Login Form') ─────────────────
  test.describe('<Component 1>', () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      // @smoke tests here
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────────
    test.describe('Edge Cases', () => {
      // @regression tests here
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      // @security tests here
    });

    // ─── Accessibility ───────────────────────────────────────────────────────
    test.describe('Accessibility', () => {
      // @a11y tests here
    });

    // ─── Visual ──────────────────────────────────────────────────────────────
    test.describe('Visual', () => {
      // @visual tests here — screenshots go in the main/first component
    });
  });

  // ─── <Component 2> (e.g. 'Remember Me', 'Sign Up Link') ───────────────────
  test.describe('<Component 2>', () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      // @smoke tests here
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────────
    test.describe('Edge Cases', () => {
      // @regression tests here
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      // @security tests here (omit section if not applicable to this component)
    });

    // ─── Accessibility ───────────────────────────────────────────────────────
    test.describe('Accessibility', () => {
      // @a11y tests here (omit section if not applicable to this component)
    });
  });
});
```

### How to name components

- Use the visible label or function of the UI element: `'Form Submission'`, `'Remember Me'`, `'Sign Up Link'`, `'Search Bar'`, `'Pagination'`
- When a page has one dominant interaction, that interaction IS the first component (e.g. `'Form Submission'` for a login page)
- Page-wide Visual snapshots and Accessibility scans go inside the main/first component describe
- Omit test-type sub-describes that don't apply (e.g. a static link has no Visual section)

## API-backed assertions — mandatory for data-heavy pages

For any page that **renders a list or dynamic data from the backend** (feeds, dashboards, tables, counts), UI tests MUST compare the rendered output against the API response — not against hardcoded expected values.

**Why:** Hardcoded `expect(count).toBe(10)` passes even if the UI has a timezone bug filtering out items. Comparing against the API catches the real class of bug: "API returned 12, UI shows 10."

### Pattern 1 — count invariant (catch filtering/timezone bugs)

```typescript
test('list count matches API @smoke', async ({homePage, apiClient}) => {
  const res = await apiClient.get('/transactions/public?page=1&limit=10');
  const {results} = await res.json();
  await expect(homePage.transactionList).toBeVisible();
  expect(await homePage.getTransactionCount()).toBe(results.length);
});
```

### Pattern 2 — value from API (catch rendering/formatting bugs)

```typescript
test('notification badge matches API unread count @smoke', async ({
  homePage,
  apiClient,
}) => {
  const res = await apiClient.get('/notifications');
  const {results} = await res.json();
  const unread = results.filter((n: {isRead: boolean}) => !n.isRead).length;
  await expect(homePage.notificationsBadge).toContainText(String(unread));
});
```

### Pattern 3 — full list cross-check (catch per-row rendering bugs, special chars, encoding)

```typescript
test('every row matches API: names, amounts, counts @regression', async ({
  homePage,
  apiClient,
}) => {
  const res = await apiClient.get('/transactions/public?page=1&limit=10');
  const {results} = await res.json();
  expect(await homePage.getTransactionCount()).toBe(results.length);
  for (let i = 0; i < results.length; i++) {
    const tx = results[i];
    const item = homePage.getTransactionAt(i);
    await expect(item).toContainText(tx.senderName);
    await expect(item).toContainText(tx.receiverName);
    await expect(item).toContainText((tx.amount / 100).toFixed(2));
    // like/comment counts
    await expect(
      item.locator('p').filter({hasText: /^\d+$/}).nth(0),
    ).toHaveText(String(tx.likes.length));
    await expect(
      item.locator('p').filter({hasText: /^\d+$/}).nth(1),
    ).toHaveText(String(tx.comments.length));
  }
});
```

### Pattern 4 — pagination deduplication (catch duplicated rows across pages)

```typescript
test('page 2 has no IDs from page 1 @regression', async ({apiClient}) => {
  const {results: p1, pageData} = await (
    await apiClient.get('/items?page=1&limit=10')
  ).json();
  if (!pageData.hasNextPages) {
    test.skip();
    return;
  }
  const {results: p2} = await (
    await apiClient.get('/items?page=2&limit=10')
  ).json();
  const overlap = p1
    .map((t: {id: string}) => t.id)
    .filter((id: string) => p2.map((t: {id: string}) => t.id).includes(id));
  expect(overlap).toHaveLength(0);
});
```

### When hardcoded seed values ARE OK

- Stable identity values that cannot be affected by filtering bugs: userId, username, static seed names used for identity (not data counts)
- Example: `await expect(homePage.username).toHaveText('@Heath93')` — this tests that the right user is logged in, not a data query result

### The `apiClient` fixture

Available in all UI tests via fixtures. It's an `APIRequestContext` pointed at `API_URL` (localhost:3001) with the shared session cookies from `storageState` — already authenticated as the seed user.

```typescript
// Destructure alongside page fixtures:
async ({homePage, apiClient}) => { ... }
async ({homePage, apiClient, page}) => { ... }
```

---

## What to write per section

### Happy Path (`@smoke`)

- Primary success flow end-to-end (valid input → submit → assert redirect or success state)
- Secondary flows if they exist (optional fields filled, remember me, etc.)
- Navigation links work (e.g. "Sign up" goes to /signup)
- **For data-heavy pages:** use Pattern 1 (count) and Pattern 2 (value from API) above

### Edge Cases (`@regression`)

- Empty form submission
- Each required field blank one at a time
- Whitespace-only inputs
- Very long inputs (200+ chars)
- Invalid format (e.g. special characters not allowed in the field being tested)
- Wrong credentials — assert error appears, user stays on page
- Special characters that are technically valid

### Security (`@security`)

- XSS in every text input: `<script>alert(1)</script>` → assert NOT executed
  ```typescript
  let xssTriggered = false;
  page.on('dialog', async dialog => {
    xssTriggered = true;
    await dialog.dismiss();
  });
  // fill and submit, then:
  expect(xssTriggered).toBe(false);
  ```
- SQL injection: `' OR '1'='1` → assert no unexpected login
- Password field must mask input — assert the input has `type="password"`: `await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')`
- Credentials not in URL after submit: `expect(page.url()).not.toContain('password')`
- Error messages don't distinguish "wrong username" from "wrong password" — both must return the exact same message (user enumeration)

### Accessibility (`@a11y`)

- Full axe-core WCAG 2.1 AA scan:
  ```typescript
  const results = await new AxeBuilder({page})
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  ```
- Every input reachable by `getByLabel`: `await expect(page.getByLabel('Username')).toBeVisible()`
- Tab navigation: Tab through each interactive element in order, assert each gets focus
- Form submittable with Enter key
- Page has exactly one `<h1>`

### Visual (`@visual`)

- Page initial state: `await expect(page).toHaveScreenshot('<feature>-initial.png', {maxDiffPixels: 50})`
- Error state (after failed submit): `await expect(page).toHaveScreenshot('<feature>-error.png', {maxDiffPixels: 50})`
- Mask dynamic content: `{mask: [page.locator('.timestamp')]}`

Add this comment at the top of the Visual section:

```typescript
// Visual baselines are created on first run. Commit __snapshots__/ to git.
// To update: npx playwright test --update-snapshots --grep @visual
```

## Shared setup

The POM fixture already calls `navigate()` internally — **do NOT call `navigate()` again in `beforeEach`**. Just request the fixture and it arrives on the correct page:

```typescript
test.describe('<Feature>', () => {
  // No beforeEach needed — the fixture handles navigation automatically.
  // Each test receives the page already on the correct URL.
  test('something @smoke', async ({<featureName>Page}) => { ... });
});
```

If a specific section needs a different starting state (e.g., pre-fill a form), use a nested `test.beforeEach` inside that describe only.

## Isolation rules

- No test depends on state from another test
- Tests that need auth use the shared `storageState` (already loaded by playwright.config.ts)
- Tests that MODIFY user data create a fresh user: `import {createUser} from '../helpers/api-helpers'`
- Visual tests: mask dynamic content (timestamps, counts, user-specific text)

## Rules

- Import from `'../fixtures'` — NOT from `@playwright/test` directly
- Use static test data from `tests/data/` for edge and security cases:
  ```typescript
  import xssPayloads from '../data/xss-payloads.json';
  import invalidInputs from '../data/invalid-inputs.json';
  import seedUsers from '../data/seed-users.json'; // only if test needs a second known user
  ```
  Use these in `test.each` loops instead of hardcoding payloads inline
- Use `page.getByRole()`, `page.getByLabel()`, `page.getByPlaceholder()` — no CSS selectors
- Use the POM's action methods in happy path; use raw locators in edge/security tests
- Tag in test name: `@smoke`, `@regression`, `@security`, `@a11y`, `@visual`
- GTS style: single quotes, 2-space indent, semicolons
- Run `npx tsc --noEmit` after writing

## Known issues to avoid — signin

- **Formik submit button starts ENABLED:** The submit button has `disabled={!isValid}` but Formik
  uses validate-on-change (not validate-on-mount). On initial page load `isValid` is `true`, so
  the button is ENABLED. Do NOT assert `toBeDisabled()` on a Formik submit button before any user
  interaction. To test the disabled state: fill a field with an invalid value (or click submit once)
  so Formik runs validation, then assert `toBeDisabled()`.

- **Sign Up link DOM detachment (Formik onBlur re-render):** Clicking the "Sign Up" link inside
  a Formik form triggers `onBlur` on the active field, which causes a re-render that replaces
  the DOM node before the click fires. Never rely on `link.click()` for navigation from a Formik
  form. Instead:
  - Assert the link target: `await expect(signUpLink).toHaveAttribute('href', '/signup')`
  - Navigate with: `await page.goto('/signup')`

- **`waitForURL` glob vs SPA navigation:** `page.waitForURL('**/signup')` can silently fail with
  React Router client-side navigation. Use a regex instead:
  `await expect(page).toHaveURL(/signup/)`

- **`toBeHidden()` not `not.toBeVisible()`:** GTS + eslint-plugin-playwright bans
  `expect(locator).not.toBeVisible()`. Always use `expect(locator).toBeHidden()` for negative
  visibility assertions.

- **`waitForTimeout` and `networkidle` are banned:** eslint-plugin-playwright blocks
  `page.waitForTimeout()` and `waitForLoadState('networkidle')`. Use
  `waitForLoadState('load')` or `waitForLoadState('domcontentloaded')` instead.

- **`page` fixture for URL checks:** `BasePage.page` is `protected`. Test files cannot access
  `signinPage.page`. Always add `page` to the fixture params when you need `page.url()`:
  `async ({signinPage, page}) => { ... }`

- **Single-param arrow functions:** GTS requires no parentheses on single-param arrow functions.
  Write `dialog => dialog.dismiss()` not `(dialog) => dialog.dismiss()`.

- **Unused destructuring variables:** GTS `no-unused-vars` does NOT exempt bare `_`.
  When destructuring to discard a field, name it `_fieldName` and add a disable comment:

  ```typescript
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {password: _password, ...safeUser} = user;
  ```

- **Tab focus order (BUG-007):** The Username input is NOT the first element to receive focus on
  Tab keypress on `/signin`. Do not write a test asserting the Username is focused after the first
  Tab — it will fail. This is a known app bug (BUG-007). Use `test.skip` with the bug reference.

- **axe-core link-name violations (BUG-006):** The `/signin` page has icon-only links without
  accessible names, causing axe-core `link-name` violations. The full WCAG 2.1 AA scan will fail.
  This is a known app bug (BUG-006). Use `test.skip` with the bug reference.

## Known issues to avoid — home (and ALL page specs)

- **Page specs use the SHARED authenticated session only — never create new contexts:** A page/feature
  UI spec tests the AUTHENTICATED page content using the shared `storageState` (already loaded by
  `playwright.config.ts`). It must **NOT** call `browser.newContext()` and must **NOT** perform a UI
  login (goto /signin → fill → submit) inside a test body. Doing so spins up a separate browser
  context per test — slow (30–60s) and flaky under retries. Auth-flow tests (login, logout,
  unauthenticated-redirect) belong in the **signin/auth spec**, which owns the login lifecycle.
  Keep page specs fast: one shared session, no per-test contexts, no in-test logins.

- **Prefer `data-test` attributes when role/href is ambiguous:** The RWA app exposes stable
  `data-test` attributes throughout. When multiple elements share a role or href, a role/text
  locator matches the wrong one. Example: the top-bar notification badge link and the sidebar
  "Notifications" nav link BOTH point to `/notifications`, so
  `getByRole('link', {name: /notifications/i})` matches the sidebar link (which has no count).
  Use the stable hooks instead: `data-test="nav-top-notifications-link"` (badge link) and
  `data-test="nav-top-notifications-count"` (count span).

- **MUI TextField `data-test` targets the wrapper div, not `<input>`:** Material-UI sets `data-test`
  on the outermost `<div>` wrapper of `<TextField>`, not on the `<input>` element inside. Calling
  `page.getByTestId('signup-password').fill(value)` will fail with "Element is not an input". Instead
  use `locator('#id')` to target the actual input by its `id` attribute (e.g. `locator('#password')`).
  This applies to all MUI TextField inputs on the signup page and any other MUI-based forms.

- **Describe-level skip for known bugs:** When an ENTIRE test category is known to fail (e.g. all
  axe-core tests fail due to BUG-006), put `test.skip(true, 'BUG-XXX: ...')` as the FIRST statement
  inside the `test.describe` block — this skips every test in the block and still documents the bug:

  ```typescript
  test.describe('Accessibility', () => {
    test.skip(true, 'BUG-006: axe-core link-name violations — icon-only links have no accessible name');
    test('no WCAG 2.1 AA violations @a11y', async ({page}) => { ... }); // skipped
    test('grid role present @a11y', async ({homePage}) => { ... });      // skipped
  });
  ```

  For individual skips (one test fails, others pass), use `test.skip()` inside that specific test.

- **axe-core link-name violations (BUG-006):** Authenticated app pages (top bar + sidebar) have
  icon-only links without accessible names, so the full WCAG 2.1 AA scan fails the `link-name` rule.
  This is the same known app bug as on `/signin` (BUG-006). Use describe-level `test.skip(true, ...)`
  with the bug reference on the entire Accessibility describe block.

- **Home tab routing:** The three tabs on the home feed route to different URLs with different section
  labels: Everyone → `/` (label "Public"), Friends → `/contacts` (label "Contacts"), Mine → `/personal`
  (label "Personal"). Do NOT assert the tab NAME as the section label — they differ by design.

- **`set-cookie` is a forbidden response header — use `page.context().cookies()` instead:**
  `page.on('response', res => res.headers()['set-cookie'])` always returns `""` — browsers
  (and Playwright) block access to `Set-Cookie` response headers due to the Forbidden Headers spec.
  To test whether a cookie is persistent (remember me) vs session, use:
  ```typescript
  const cookies = await page.context().cookies();
  const sid = cookies.find(c => c.name === 'connect.sid');
  expect(sid?.expires).toBeGreaterThan(0); // > 0 = persistent; === -1 = session
  ```

## Test ownership pattern — MANDATORY

Each spec file owns assertions only for its own feature. This is the most important structural rule.

**Rule:** When a test navigates to another feature's page (to verify a link works, for example), stop asserting after:

1. `await expect(page).toHaveURL(/destination-path/)` — URL changed correctly
2. `await expect(destinationPage.readyAnchor).toBeVisible()` — destination rendered

**Never** assert content (names, amounts, descriptions, counts) that belongs to the destination page's spec.

**Example — correct (home.spec.ts):**

```typescript
test('clicking a transaction row navigates to the correct /transaction/{id} @smoke', async ({
  homePage,
  transactionPage,
  apiClient,
  page,
}) => {
  const {results} = await (
    await apiClient.get('/transactions/public?page=1&limit=10')
  ).json();
  await homePage.getTransactionAt(0).click();
  await expect(page).toHaveURL(new RegExp(`/transaction/${results[0].id}`));
  await expect(transactionPage.transactionDetailHeader).toBeVisible(); // ← STOP HERE
  // sender, receiver, amount, likes, comments → those go in transaction.spec.ts
});
```

**Example — WRONG (do not do this in home.spec.ts):**

```typescript
// ❌ Asserting destination content from home.spec.ts
await expect(
  page.locator('[data-test="transaction-detail-header"]'),
).toBeVisible();
await expect(page.locator(`[data-test="transaction-sender-${id}"]`)).toHaveText(
  'Alice',
);
// ❌ Raw locator instead of POM
```

**Cross-page link-works tests (e.g. "Sign Up link lands on signup form"):**
When verifying that a link navigates to another feature's page and you cannot use that feature's fixture (it would conflict by re-navigating), import the destination POM class and instantiate it directly with the same `page`:

```typescript
// In signin.spec.ts — verifying Sign Up link destination:
import {SignupPage} from '../pages/signup.page';

await page.goto('/signup');
await expect(page).toHaveURL(/signup/);
await expect(new SignupPage(page).submitButton).toBeVisible(); // ← POM locator, no raw selector
// NOT page.locator('[data-test="signup-submit"]') — the locator belongs in the POM
// NOT page.getByRole('button', ...) — use POM
```

Locators always live in the POM. Never hardcode selectors in test files.

**E2E flows that span multiple features** → `tests/e2e/<flow-name>.spec.ts`, not in feature specs.

## Output

Write the single file directly. No explanation.
