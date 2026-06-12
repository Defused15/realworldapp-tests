---
name: ui-test-agent
description: Writes all UI tests for a feature in a single file — happy path, edge cases, security, accessibility, and visual regression — organized in test.describe blocks. Uses the Page Object from pom-agent.
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

```typescript
// tests/ui/<feature>.spec.ts

import {test, expect} from '../fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('<Feature>', () => {
  // ─── Happy Path ────────────────────────────────────────────────────────────
  test.describe('Happy Path', () => {
    // @smoke tests here
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────────
  test.describe('Edge Cases', () => {
    // @regression tests here
  });

  // ─── Security ──────────────────────────────────────────────────────────────
  test.describe('Security', () => {
    // @security tests here
  });

  // ─── Accessibility ─────────────────────────────────────────────────────────
  test.describe('Accessibility', () => {
    // @a11y tests here
  });

  // ─── Visual ────────────────────────────────────────────────────────────────
  test.describe('Visual', () => {
    // @visual tests here
  });
});
```

## What to write per section

### Happy Path (`@smoke`)

- Primary success flow end-to-end (valid input → submit → assert redirect or success state)
- Secondary flows if they exist (optional fields filled, remember me, etc.)
- Navigation links work (e.g. "Sign up" goes to /signup)

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

## Output

Write the single file directly. No explanation.
