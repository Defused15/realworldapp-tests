import {type Page, type Locator} from '@playwright/test';
import {BasePage} from './base.page';

export class SigninPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signUpLink: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', {name: /sign in/i});
    this.errorMessage = page.getByText('Username or password is invalid');
    this.signUpLink = page.getByRole('link', {name: /sign up/i});
    this.heading = page.getByRole('heading', {name: /sign in/i});
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
    return (await this.errorMessage.textContent()) ?? '';
  }

  async isErrorVisible(): Promise<boolean> {
    return this.errorMessage.isVisible();
  }
}
