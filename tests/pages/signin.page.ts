import {type Page, type Locator} from '@playwright/test';
import {BasePage} from './base.page';

export class SigninPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signUpLink: Locator;
  readonly heading: Locator;
  readonly rememberMeCheckbox: Locator;

  constructor(page: Page) {
    super(page);
    // MUI TextField: data-test is on the wrapper DIV, not the <input>.
    // Use #id to target the actual input element.
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('[data-test="signin-submit"]');
    this.errorMessage = page.locator('[data-test="signin-error"]');
    // data-test="signup" is on the <A> element directly — safe to use
    this.signUpLink = page.locator('[data-test="signup"]');
    this.heading = page.getByRole('heading', {name: /sign in/i});
    // data-test="signin-remember-me" is on a SPAN wrapper; target the input inside
    this.rememberMeCheckbox = page.locator(
      '[data-test="signin-remember-me"] input[type="checkbox"]',
    );
  }

  async navigate(): Promise<void> {
    await this.page.goto('/signin');
  }

  async signIn(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async signInAndWait(username: string, password: string): Promise<void> {
    await this.signIn(username, password);
    await this.page.waitForURL(url => !url.pathname.includes('/signin'));
  }

  async getErrorMessage(): Promise<string> {
    await this.errorMessage.waitFor({state: 'visible'});
    return (await this.errorMessage.innerText()).trim();
  }

  async isErrorVisible(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }

  async checkRememberMe(): Promise<void> {
    if (!(await this.rememberMeCheckbox.isChecked())) {
      await this.rememberMeCheckbox.check();
    }
  }

  async signInWithRemember(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.checkRememberMe();
    await this.submitButton.click();
  }
}
