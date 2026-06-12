---
name: debug-test
description: Debug a failing Playwright test. Reads the error, trace, and screenshots to identify the root cause and propose a fix.
---

Debug a failing Playwright test and propose a fix.

## Instructions

1. If the user provided a test name or file, use it. Otherwise ask which test is failing.

2. Run the failing test to capture fresh output:

   ```bash
   npx playwright test <test-name> --reporter=list 2>&1
   ```

3. Check for Playwright trace/screenshot artifacts:
   - Look in `playwright-report/` and `test-results/` for screenshots, traces, or videos
   - If a trace exists, read it to understand what happened

4. Analyze the failure:
   - **Selector errors** (`strict mode violation`, `locator not found`) → suggest better selectors using `getByRole`/`getByLabel`
   - **Timeout errors** → suggest explicit waits (`waitForURL`, `waitForLoadState`, `expect().toBeVisible()`)
   - **Network errors** → check if `baseURL` is set in `playwright.config.ts`
   - **Assertion failures** → read the expected vs received values and trace back the cause

5. Show the root cause clearly and apply the fix directly to the test file.

6. Re-run the test to confirm it passes.

## Example invocation

`/debug-test`
`/debug-test login flow`
`/debug-test tests/checkout.spec.ts`
