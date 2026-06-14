import {test as base, type APIRequestContext} from '@playwright/test';
import {SigninPage} from '../pages/signin.page';
import {SignupPage} from '../pages/signup.page';
import {HomePage} from '../pages/home.page';
import {TransactionPage} from '../pages/transaction.page';

export interface AppFixtures {
  apiClient: APIRequestContext;
  signinPage: SigninPage;
  signupPage: SignupPage;
  homePage: HomePage;
  transactionPage: TransactionPage;
}

export const test = base.extend<AppFixtures>({
  apiClient: async ({request}, use) => {
    await use(request);
  },

  signinPage: async ({page}, use, testInfo) => {
    await clearAuthState(page);
    await setupPage(page);
    const signinPage = new SigninPage(page);
    await signinPage.navigate();
    await use(signinPage);
    await teardownPage(page, testInfo);
  },

  signupPage: async ({page}, use, testInfo) => {
    await clearAuthState(page);
    await setupPage(page);
    const signupPage = new SignupPage(page);
    await signupPage.navigate();
    await use(signupPage);
    await teardownPage(page, testInfo);
  },

  homePage: async ({page}, use, testInfo) => {
    await setupPage(page);
    const homePage = new HomePage(page);
    await homePage.navigate();
    await use(homePage);
    await teardownPage(page, testInfo);
  },

  // Protected page — storageState provides the session; no auth clear needed.
  // Navigation is handled per-test (each test calls transactionPage.navigate(txId))
  // so no navigate() call is made here.
  transactionPage: async ({page}, use, testInfo) => {
    await setupPage(page);
    const transactionPage = new TransactionPage(page);
    await use(transactionPage);
    await teardownPage(page, testInfo);
  },
});

// Fully de-authenticate the shared context for signin/signup specs.
// The RWA frontend is a client-side-auth SPA: its XState machine persists
// `authState` in localStorage (not just the session cookie). The shared
// storageState injects that authState at context creation, so clearing cookies
// alone leaves XState booting as "authorized" — it then redirects /signin → /,
// and the signin form never renders (every locator times out).
// We must clear localStorage too. addInitScript runs at document-start on every
// navigation, before app scripts read localStorage, so XState boots "unauthorized".
export async function clearAuthState(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.context().clearCookies();
  await page.addInitScript(() => window.localStorage.clear());
}

// Re-export so page fixtures added by pom-agent can call these.
// For pages that require an unauthenticated state (signin, signup), the pom-agent
// fixture should call `await clearAuthState(page)` BEFORE setupPage.
// Protected pages (transactions, profile) should NOT clear auth — storageState provides the session.
export async function setupPage(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
