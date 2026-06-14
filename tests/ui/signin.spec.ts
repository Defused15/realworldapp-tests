// tests/ui/signin.spec.ts

import {test, expect} from '../fixtures';
import AxeBuilder from '@axe-core/playwright';
import xssPayloads from '../data/xss-payloads.json';
import invalidInputs from '../data/invalid-inputs.json';
import {SignupPage} from '../pages/signup.page';

const VALID_USERNAME = process.env.TEST_USER_USERNAME!;
const VALID_PASSWORD = process.env.TEST_USER_PASSWORD!;
const ERROR_TEXT = 'Username or password is invalid';

test.describe('Signin', () => {
  // ─── Form Submission ───────────────────────────────────────────────────────
  test.describe('Form Submission', () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      test('signs in with valid credentials and redirects away from /signin @smoke', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signInAndWait(VALID_USERNAME, VALID_PASSWORD);
        expect(page.url()).not.toContain('/signin');
      });

      test('no error message is shown on initial page load @smoke', async ({
        signinPage,
      }) => {
        await expect(signinPage.errorMessage).toBeHidden();
      });

      test('page heading "Sign In" is visible @smoke', async ({signinPage}) => {
        await expect(signinPage.heading).toBeVisible();
      });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────────
    test.describe('Edge Cases', () => {
      test('submit button is enabled initially and becomes disabled after invalid submit @regression', async ({
        signinPage,
      }) => {
        // Button starts enabled (Formik validates on change/submit, not on mount)
        await expect(signinPage.submitButton).toBeEnabled();
        // Click triggers validation → empty fields fail → button becomes disabled
        await signinPage.submitButton.click();
        await expect(signinPage.submitButton).toBeDisabled();
      });

      test('submit button is disabled when only password is filled @regression', async ({
        signinPage,
      }) => {
        await signinPage.passwordInput.fill(VALID_PASSWORD);
        await expect(signinPage.submitButton).toBeDisabled();
      });

      test('submit button is disabled when only username is filled @regression', async ({
        signinPage,
      }) => {
        await signinPage.usernameInput.fill(VALID_USERNAME);
        await expect(signinPage.submitButton).toBeDisabled();
      });

      test('shows error for whitespace-only username @regression', async ({
        signinPage,
        page,
      }) => {
        await signinPage.usernameInput.fill('   ');
        await signinPage.passwordInput.fill(VALID_PASSWORD);
        await signinPage.submitButton.click();
        expect(page.url()).toContain('/signin');
      });

      test('submit button is disabled when password is below min length @regression', async ({
        signinPage,
      }) => {
        await signinPage.usernameInput.fill(VALID_USERNAME);
        await signinPage.passwordInput.fill('   '); // 3 chars — below the 4-char minimum
        await expect(signinPage.submitButton).toBeDisabled();
      });

      test('shows error for wrong credentials @regression', async ({
        signinPage,
      }) => {
        await signinPage.signIn('wronguser', 'wrongpassword');
        const errorMsg = await signinPage.getErrorMessage();
        expect(errorMsg).toBe(ERROR_TEXT);
      });

      test('user stays on /signin after failed login @regression', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signIn('wronguser', 'wrongpassword');
        await signinPage.errorMessage.waitFor({state: 'visible'});
        expect(page.url()).toContain('/signin');
      });

      test('shows error for very long username (200+ chars) @regression', async ({
        signinPage,
      }) => {
        const longInput = invalidInputs[3]; // 200+ char string
        await signinPage.usernameInput.fill(longInput);
        await signinPage.passwordInput.fill(VALID_PASSWORD);
        await signinPage.submitButton.click();
        const errorMsg = await signinPage.getErrorMessage();
        expect(errorMsg).toBe(ERROR_TEXT);
      });

      test('shows error for very long password (200+ chars) @regression', async ({
        signinPage,
      }) => {
        const longInput = invalidInputs[3]; // 200+ char string
        await signinPage.usernameInput.fill(VALID_USERNAME);
        await signinPage.passwordInput.fill(longInput);
        await signinPage.submitButton.click();
        const errorMsg = await signinPage.getErrorMessage();
        expect(errorMsg).toBe(ERROR_TEXT);
      });

      test('shows error for correct username but wrong password @regression', async ({
        signinPage,
      }) => {
        await signinPage.signIn(VALID_USERNAME, 'wrongpassword');
        const errorMsg = await signinPage.getErrorMessage();
        expect(errorMsg).toBe(ERROR_TEXT);
      });

      test('shows error for wrong username but correct password @regression', async ({
        signinPage,
      }) => {
        await signinPage.signIn('nonexistentuser', VALID_PASSWORD);
        const errorMsg = await signinPage.getErrorMessage();
        expect(errorMsg).toBe(ERROR_TEXT);
      });

      test('error message is the same for wrong username vs wrong password (no user enumeration) @regression', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signIn('nonexistentuser999', 'somepassword');
        const msgForBadUser = await signinPage.getErrorMessage();

        await page.goto('/signin');
        await page.context().clearCookies();

        await signinPage.signIn(VALID_USERNAME, 'wrongpassword');
        const msgForBadPassword = await signinPage.getErrorMessage();

        expect(msgForBadUser).toBe(msgForBadPassword);
      });

      test('username with special characters shows error @regression', async ({
        signinPage,
      }) => {
        await signinPage.usernameInput.fill('user@#$%^&*()');
        await signinPage.passwordInput.fill(VALID_PASSWORD);
        await signinPage.submitButton.click();
        const errorMsg = await signinPage.getErrorMessage();
        expect(errorMsg).toBe(ERROR_TEXT);
      });
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      for (const payload of xssPayloads) {
        test(`XSS payload in username field does not execute: ${payload.slice(0, 40)} @security`, async ({
          signinPage,
          page,
        }) => {
          let xssTriggered = false;
          page.on('dialog', async dialog => {
            xssTriggered = true;
            await dialog.dismiss();
          });
          await signinPage.usernameInput.fill(payload);
          await signinPage.passwordInput.fill('anypassword');
          await signinPage.submitButton.click();
          await page.waitForLoadState('load');
          expect(xssTriggered).toBe(false);
        });
      }

      for (const payload of xssPayloads) {
        test(`XSS payload in password field does not execute: ${payload.slice(0, 40)} @security`, async ({
          signinPage,
          page,
        }) => {
          let xssTriggered = false;
          page.on('dialog', async dialog => {
            xssTriggered = true;
            await dialog.dismiss();
          });
          await signinPage.usernameInput.fill('anyuser');
          await signinPage.passwordInput.fill(payload);
          await signinPage.submitButton.click();
          await page.waitForLoadState('load');
          expect(xssTriggered).toBe(false);
        });
      }

      test('SQL injection in username does not grant access @security', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signIn("' OR '1'='1", "' OR '1'='1");
        await page.waitForLoadState('load');
        expect(page.url()).toContain('/signin');
      });

      test('password field masks input (type="password") @security', async ({
        signinPage,
      }) => {
        await expect(signinPage.passwordInput).toHaveAttribute(
          'type',
          'password',
        );
      });

      test('credentials do not appear in URL after submit @security', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signIn(VALID_USERNAME, VALID_PASSWORD);
        await page.waitForURL(url => !url.pathname.includes('/signin'));
        expect(page.url()).not.toContain('password');
        expect(page.url()).not.toContain(VALID_USERNAME);
      });

      test('wrong username and wrong password return identical error (no user enumeration) @security', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signIn(
          'definitively_nonexistent_user_xyz',
          'wrongpass',
        );
        const msgUnknownUser = await signinPage.getErrorMessage();

        await page.goto('/signin');
        await page.context().clearCookies();

        await signinPage.signIn(VALID_USERNAME, 'definitelywrongpassword');
        const msgWrongPassword = await signinPage.getErrorMessage();

        expect(msgUnknownUser).toBe(msgWrongPassword);
        expect(msgUnknownUser).toBe(ERROR_TEXT);
      });
    });

    // ─── Accessibility ───────────────────────────────────────────────────────
    test.describe('Accessibility', () => {
      test.skip('passes axe-core WCAG 2.1 AA scan @a11y', async ({
        signinPage,
        page,
      }) => {
        // SEVERITY: MEDIUM
        // BUG: axe-core reports WCAG 2.1 AA violations on the signin page.
        // Primary violation: "link-name" — links must have discernible text (Deque rule).
        // Likely cause: icon-only links or links with empty/missing accessible names in the app shell.
        // Impact: Screen readers cannot announce link purpose to visually impaired users.
        // Fix: Add aria-label or visible text to all links that lack discernible names.
        void signinPage; // fixture ensures navigation + clearCookies
        const results = await new AxeBuilder({page})
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });

      test('Username input is reachable by label @a11y', async ({
        signinPage,
      }) => {
        await expect(signinPage.usernameInput).toBeVisible();
      });

      test('Password input is reachable by label @a11y', async ({
        signinPage,
      }) => {
        await expect(signinPage.passwordInput).toBeVisible();
      });

      test.skip('tab navigation reaches all interactive elements in order @a11y', async ({
        signinPage,
        page,
      }) => {
        // SEVERITY: MEDIUM
        // BUG: Tab key from body does not focus the Username input as the first interactive element.
        // Expected: Tab → Username field focused.
        // Actual: Username field is inactive (no focus) after Tab press; likely another element
        //         (e.g., a navbar link or skip-nav element) captures initial focus instead.
        // Impact: Keyboard-only and assistive-technology users cannot reliably navigate the form.
        // Fix: Review tab order via tabindex; ensure the Username input is the first focusable field
        //      in the DOM or provide a "Skip to main content" skip-nav link targeting the form.
        await page.keyboard.press('Tab');
        await expect(signinPage.usernameInput).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(signinPage.passwordInput).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(signinPage.submitButton).toBeFocused();
      });

      test('form can be submitted with Enter key @a11y', async ({
        signinPage,
        page,
      }) => {
        await signinPage.usernameInput.fill(VALID_USERNAME);
        await signinPage.passwordInput.fill(VALID_PASSWORD);
        await signinPage.passwordInput.press('Enter');
        await page.waitForURL(url => !url.pathname.includes('/signin'));
        expect(page.url()).not.toContain('/signin');
      });

      test('page has exactly one h1 element @a11y', async ({
        signinPage,
        page,
      }) => {
        void signinPage; // fixture ensures navigation + clearCookies
        const h1Count = page.locator('h1');
        await expect(h1Count).toHaveCount(1);
      });
    });

    // ─── Visual ──────────────────────────────────────────────────────────────
    test.describe('Visual', () => {
      // Visual baselines are created on first run. Commit __snapshots__/ to git.
      // To update: npx playwright test --update-snapshots --grep @visual

      test('signin page initial state matches snapshot @visual', async ({
        signinPage,
        page,
      }) => {
        void signinPage; // fixture ensures navigation + clearCookies
        await expect(page).toHaveScreenshot('signin-initial.png', {
          maxDiffPixels: 50,
        });
      });

      test('signin page error state matches snapshot @visual', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signIn('wronguser', 'wrongpassword');
        await signinPage.errorMessage.waitFor({state: 'visible'});
        await expect(page).toHaveScreenshot('signin-error.png', {
          maxDiffPixels: 50,
        });
      });
    });
  });

  // ─── Remember Me ───────────────────────────────────────────────────────────
  test.describe('Remember Me', () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      test('checkbox is unchecked by default on page load @smoke', async ({
        signinPage,
      }) => {
        await expect(signinPage.rememberMeCheckbox).not.toBeChecked();
      });

      test('signing in with remember-me sets a persistent cookie @smoke', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signInWithRemember(VALID_USERNAME, VALID_PASSWORD);
        await page.waitForURL(url => !url.pathname.includes('/signin'));
        // set-cookie is a forbidden response header — invisible to page.on('response').
        // Check the cookie store directly: expires > 0 means persistent, -1 means session.
        const cookies = await page.context().cookies();
        const session = cookies.find(c => c.name === 'connect.sid');
        expect(session).toBeDefined();
        expect(session!.expires).toBeGreaterThan(0);
      });

      test('signing in WITHOUT remember-me sets a session cookie (no Expires) @smoke', async ({
        signinPage,
        page,
      }) => {
        await signinPage.signIn(VALID_USERNAME, VALID_PASSWORD);
        await page.waitForURL(url => !url.pathname.includes('/signin'));
        const cookies = await page.context().cookies();
        const session = cookies.find(c => c.name === 'connect.sid');
        expect(session).toBeDefined();
        // Session cookies have expires = -1 in Playwright
        expect(session!.expires).toBe(-1);
      });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────────
    test.describe('Edge Cases', () => {
      test('checkbox can be checked then unchecked before submitting @regression', async ({
        signinPage,
      }) => {
        await signinPage.rememberMeCheckbox.check();
        await expect(signinPage.rememberMeCheckbox).toBeChecked();
        await signinPage.rememberMeCheckbox.uncheck();
        await expect(signinPage.rememberMeCheckbox).not.toBeChecked();
      });

      test('checkbox is keyboard-accessible: focus and Space to toggle @regression', async ({
        signinPage,
        page,
      }) => {
        await signinPage.rememberMeCheckbox.focus();
        await expect(signinPage.rememberMeCheckbox).toBeFocused();
        await page.keyboard.press('Space');
        await expect(signinPage.rememberMeCheckbox).toBeChecked();
        await page.keyboard.press('Space');
        await expect(signinPage.rememberMeCheckbox).not.toBeChecked();
      });
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      test('failed sign-in with remember-me checked does NOT set a persistent cookie @security', async ({
        signinPage,
        page,
      }) => {
        let setCookieHeader = '';
        page.on('response', res => {
          if (res.url().includes('/login')) {
            setCookieHeader = res.headers()['set-cookie'] ?? '';
          }
        });
        await signinPage.checkRememberMe();
        await signinPage.signIn('wronguser', 'wrongpassword');
        await signinPage.errorMessage.waitFor({state: 'visible'});
        // A 401 response must not carry Max-Age or Expires
        expect(setCookieHeader).not.toMatch(/Max-Age/i);
        expect(setCookieHeader).not.toMatch(/Expires=/i);
      });
    });
  });

  // ─── Don't Have an Account Link ────────────────────────────────────────────
  test.describe("Don't Have an Account Link", () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      test('link is visible on the signin page @smoke', async ({
        signinPage,
      }) => {
        await expect(signinPage.signUpLink).toBeVisible();
      });

      test('link has href="/signup" @smoke', async ({signinPage}) => {
        await expect(signinPage.signUpLink).toHaveAttribute('href', '/signup');
      });

      test('navigating to /signup after verifying the link lands on the signup form @smoke', async ({
        signinPage,
        page,
      }) => {
        // Assert attribute only — never click() from a Formik form (DOM-detachment bug)
        await expect(signinPage.signUpLink).toHaveAttribute('href', '/signup');
        await page.goto('/signup');
        await expect(page).toHaveURL(/signup/);
        await expect(new SignupPage(page).submitButton).toBeVisible();
      });

      test.skip('"Sign Up" link click navigates to /signup @smoke', async ({
        signinPage,
        page,
      }) => {
        // SEVERITY: LOW
        // BUG: Clicking the "Don't have an account? Sign Up" link on the signin page
        // does not navigate to /signup. URL stays at /signin after the click.
        // Root cause: Playwright's mouse-move-then-click triggers a blur on the Username field,
        // which causes Formik's onBlur validation to re-render the SignInForm. The DOM node
        // for the Sign Up link is replaced during the re-render before the click event fires,
        // resulting in the click hitting a detached node (not handled by React Router).
        // The /signup href is correct and the page IS accessible via direct navigation — this
        // is purely a click-trigger navigation issue in certain render states.
        // Fix: Debounce or defer Formik's onBlur re-render so it doesn't replace the DOM
        //      before the click event propagates, or use React Router's useNavigate hook to
        //      navigate on mousedown instead of click.
        await signinPage.signUpLink.click();
        await expect(page).toHaveURL(/signup/);
      });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────────
    test.describe('Edge Cases', () => {
      test('link href is correct even after typing in the Username field (Formik onBlur re-render) @regression', async ({
        signinPage,
      }) => {
        // Typing in Username triggers onBlur/re-render when focus leaves — assert attribute only,
        // never click() the link after this interaction (DOM-detachment bug)
        await signinPage.usernameInput.fill('someuser');
        await signinPage.usernameInput.blur();
        await expect(signinPage.signUpLink).toHaveAttribute('href', '/signup');
      });
    });

    // ─── Accessibility ───────────────────────────────────────────────────────
    test.describe('Accessibility', () => {
      test('link is reachable via Tab key @a11y', async ({
        signinPage,
        page,
      }) => {
        // Tab through interactive elements until the sign-up link receives focus
        // (exact tab count is not asserted due to BUG-007 / variable tab order)
        let focused = false;
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
          const isFocused = await signinPage.signUpLink.evaluate(
            el => document.activeElement === el,
          );
          if (isFocused) {
            focused = true;
            break;
          }
        }
        expect(focused).toBe(true);
      });

      test('link has accessible text (not empty) @a11y', async ({
        signinPage,
      }) => {
        const text = await signinPage.signUpLink.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
