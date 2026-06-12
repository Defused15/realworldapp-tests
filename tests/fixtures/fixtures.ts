import {test as base, type APIRequestContext} from '@playwright/test';
import {SigninPage} from '../pages/signin.page';
import {SignupPage} from '../pages/signup.page';

export interface AppFixtures {
  apiClient: APIRequestContext;
  signinPage: SigninPage;
  signupPage: SignupPage;
}

export const test = base.extend<AppFixtures>({
  apiClient: async ({request}, use) => {
    await use(request);
  },

  signinPage: async ({page}, use, testInfo) => {
    await page.context().clearCookies();
    await setupPage(page);
    const signinPage = new SigninPage(page);
    await signinPage.navigate();
    await use(signinPage);
    await teardownPage(page, testInfo);
  },

  signupPage: async ({page}, use, testInfo) => {
    await page.context().clearCookies();
    await setupPage(page);
    const signupPage = new SignupPage(page);
    await signupPage.navigate();
    await use(signupPage);
    await teardownPage(page, testInfo);
  },
});

// Re-export so page fixtures added by pom-agent can call these.
// For pages that require an unauthenticated state (signin, signup), the pom-agent
// fixture should call `await page.context().clearCookies()` BEFORE setupPage.
// Protected pages (transactions, profile) should NOT clear cookies — storageState provides the session.
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
