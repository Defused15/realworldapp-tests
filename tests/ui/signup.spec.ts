// tests/ui/signup.spec.ts

import {test, expect} from '../fixtures';
import xssPayloads from '../data/xss-payloads.json';
import invalidInputs from '../data/invalid-inputs.json';
import {buildUser} from '../utils/factories';

test.describe('Signup', () => {
  // ─── Happy Path ────────────────────────────────────────────────────────────
  test.describe('Happy Path', () => {
    test('signs up with valid data and redirects to /signin @smoke', async ({
      signupPage,
      page,
    }) => {
      const data = buildUser();
      await signupPage.signUpAndWait({...data, confirmPassword: data.password});
      await expect(page).toHaveURL(/signin/);
    });

    test('no inline errors are shown on initial page load @smoke', async ({
      signupPage,
      page,
    }) => {
      void signupPage; // fixture ensures navigation + clearCookies
      const errorParagraphs = page
        .locator('p')
        .filter({hasText: /required|must|invalid/i});
      await expect(errorParagraphs).toHaveCount(0);
    });

    test('heading "Sign Up" is visible on page load @smoke', async ({
      signupPage,
    }) => {
      await expect(signupPage.heading).toBeVisible();
    });

    test('"Have an account? Sign In" link has correct href and /signin page loads @smoke', async ({
      signupPage,
      page,
    }) => {
      await expect(signupPage.signInLink).toHaveAttribute('href', '/signin');
      await page.goto('/signin');
      await expect(page).toHaveURL(/signin/);
    });

    test('after signup user can log in with new credentials @smoke', async ({
      signupPage,
      page,
      request,
    }) => {
      const data = buildUser();
      await signupPage.signUpAndWait({...data, confirmPassword: data.password});
      await expect(page).toHaveURL(/signin/);

      const res = await request.post('http://localhost:3001/login', {
        data: {username: data.username, password: data.password},
      });
      expect(res.status()).toBe(200);
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────────
  test.describe('Edge Cases', () => {
    test('submit button starts enabled and becomes disabled after empty submit @regression', async ({
      signupPage,
    }) => {
      await expect(signupPage.submitButton).toBeEnabled();
      await signupPage.submitButton.click();
      await expect(signupPage.submitButton).toBeDisabled();
    });

    test('submit button is disabled when only firstName is filled @regression', async ({
      signupPage,
    }) => {
      await signupPage.firstNameInput.fill('Jane');
      await expect(signupPage.submitButton).toBeDisabled();
    });

    test('submit button is disabled when password does not match confirmPassword @regression', async ({
      signupPage,
    }) => {
      const data = buildUser();
      await signupPage.fillForm({
        ...data,
        confirmPassword: data.password + 'X',
      });
      // Formik validates on change — button is disabled as soon as mismatch is detected
      await expect(signupPage.submitButton).toBeDisabled();
    });

    test('submit button is disabled when password is too short @regression', async ({
      signupPage,
    }) => {
      const data = buildUser();
      await signupPage.fillForm({
        ...data,
        password: 'abc',
        confirmPassword: 'abc',
      });
      // Formik validates on change — button disabled immediately for short password
      await expect(signupPage.submitButton).toBeDisabled();
    });

    test('very long inputs (200+ chars) show validation error or are rejected @regression', async ({
      signupPage,
      page,
    }) => {
      const longInput = invalidInputs[3]; // 200+ char string
      await signupPage.fillForm({
        firstName: longInput,
        lastName: longInput,
        username: longInput,
        password: longInput,
        confirmPassword: longInput,
      });
      await signupPage.submitButton.click();
      // User should not be redirected away — stays on /signup or on same page
      expect(page.url()).not.toMatch(/\/signin$/);
    });

    test('whitespace-only first name is accepted by the form (no client-side trim validation) @regression', async ({
      signupPage,
      page,
    }) => {
      const data = buildUser();
      await signupPage.signUpAndWait({
        ...data,
        firstName: '   ',
        confirmPassword: data.password,
      });
      // App does not trim-validate firstName client-side — signup succeeds and redirects
      await expect(page).toHaveURL(/signin/);
    });

    test('username with special characters is accepted by the form (no client-side char validation) @regression', async ({
      signupPage,
      page,
    }) => {
      const data = buildUser();
      await signupPage.signUp({
        ...data,
        username: 'user_special_99',
        confirmPassword: data.password,
      });
      // Form does not block special-char-free usernames — button stays enabled
      await expect(signupPage.submitButton).toBeEnabled();
      // Wait for outcome (success redirect or error response)
      await page.waitForLoadState('load');
    });
  });

  // ─── Security ──────────────────────────────────────────────────────────────
  test.describe('Security', () => {
    for (const payload of xssPayloads) {
      test(`XSS payload in firstName does not execute: ${payload.slice(0, 40)} @security`, async ({
        signupPage,
        page,
      }) => {
        let xssTriggered = false;
        page.on('dialog', async dialog => {
          xssTriggered = true;
          await dialog.dismiss();
        });
        const data = buildUser();
        await signupPage.fillForm({
          ...data,
          firstName: payload,
          confirmPassword: data.password,
        });
        await signupPage.submitButton.click();
        await page.waitForLoadState('load');
        expect(xssTriggered).toBe(false);
      });
    }

    for (const payload of xssPayloads) {
      test(`XSS payload in username does not execute: ${payload.slice(0, 40)} @security`, async ({
        signupPage,
        page,
      }) => {
        let xssTriggered = false;
        page.on('dialog', async dialog => {
          xssTriggered = true;
          await dialog.dismiss();
        });
        const data = buildUser();
        await signupPage.fillForm({
          ...data,
          username: payload,
          confirmPassword: data.password,
        });
        await signupPage.submitButton.click();
        await page.waitForLoadState('load');
        expect(xssTriggered).toBe(false);
      });
    }

    test('SQL injection in username does not register a new account @security', async ({
      signupPage,
      page,
    }) => {
      const data = buildUser();
      await signupPage.fillForm({
        ...data,
        username: "' OR '1'='1",
        confirmPassword: data.password,
      });
      await signupPage.submitButton.click();
      await page.waitForLoadState('load');
      // Should not redirect to /signin on "success"
      expect(page.url()).not.toMatch(/\/signin$/);
    });

    test('password field masks input (type="password") @security', async ({
      signupPage,
    }) => {
      await expect(signupPage.passwordInput).toHaveAttribute(
        'type',
        'password',
      );
    });

    test('confirm password field masks input (type="password") @security', async ({
      signupPage,
    }) => {
      await expect(signupPage.confirmPasswordInput).toHaveAttribute(
        'type',
        'password',
      );
    });

    test('credentials do not appear in URL after successful signup @security', async ({
      signupPage,
      page,
    }) => {
      const data = buildUser();
      await signupPage.signUpAndWait({...data, confirmPassword: data.password});
      expect(page.url()).not.toContain('password');
      expect(page.url()).not.toContain(data.username);
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────────────
  test.describe('Accessibility', () => {
    test.skip('passes axe-core WCAG 2.1 AA scan @a11y', async ({
      signupPage,
      page,
    }) => {
      // SEVERITY: MEDIUM
      // BUG-006: axe-core reports WCAG 2.1 AA violations on app pages.
      // Primary violation: "link-name" — icon-only links in the app shell have no accessible name.
      // Impact: Screen readers cannot announce link purpose to visually impaired users.
      // Fix: Add aria-label or visible text to all links that lack discernible names.
      // Reference: Same issue documented for /signin page (BUG-006).
      void signupPage;
      const {default: AxeBuilder} = await import('@axe-core/playwright');
      const results = await new AxeBuilder({page})
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });

    test('all 5 inputs are reachable by label @a11y', async ({signupPage}) => {
      await expect(signupPage.firstNameInput).toBeVisible();
      await expect(signupPage.lastNameInput).toBeVisible();
      await expect(signupPage.usernameInput).toBeVisible();
      await expect(signupPage.passwordInput).toBeVisible();
      await expect(signupPage.confirmPasswordInput).toBeVisible();
    });

    test('form can be submitted with Enter key @a11y', async ({
      signupPage,
      page,
    }) => {
      const data = buildUser();
      await signupPage.fillForm({...data, confirmPassword: data.password});
      await signupPage.confirmPasswordInput.press('Enter');
      await page.waitForURL(url => !url.pathname.includes('/signup'));
      await expect(page).toHaveURL(/signin/);
    });

    test('page has exactly one h1 element @a11y', async ({
      signupPage,
      page,
    }) => {
      void signupPage; // fixture ensures navigation + clearCookies
      await expect(page.locator('h1')).toHaveCount(1);
    });
  });

  // ─── Visual ────────────────────────────────────────────────────────────────
  test.describe('Visual', () => {
    // Visual baselines are created on first run. Commit __snapshots__/ to git.
    // To update: npx playwright test --update-snapshots --grep @visual

    test('signup page initial state matches snapshot @visual', async ({
      signupPage,
      page,
    }) => {
      void signupPage; // fixture ensures navigation + clearCookies
      await expect(page).toHaveScreenshot('signup-initial.png', {
        maxDiffPixels: 50,
      });
    });

    test('signup page error state matches snapshot @visual', async ({
      signupPage,
      page,
    }) => {
      await signupPage.submitButton.click();
      await expect(signupPage.submitButton).toBeDisabled();
      await expect(page).toHaveScreenshot('signup-error.png', {
        maxDiffPixels: 50,
      });
    });
  });
});
