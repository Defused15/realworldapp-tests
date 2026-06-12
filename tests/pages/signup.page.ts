import {type Page, type Locator} from '@playwright/test';
import {BasePage} from './base.page';

export interface SignupFormData {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export class SignupPage extends BasePage {
  readonly heading: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly signInLink: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', {name: 'Sign Up', level: 1});
    this.firstNameInput = page.getByRole('textbox', {name: 'First Name'});
    this.lastNameInput = page.getByRole('textbox', {name: 'Last Name'});
    this.usernameInput = page.getByRole('textbox', {name: 'Username'});
    this.passwordInput = page
      .locator('[data-test="signup-password"]')
      .getByRole('textbox', {name: 'Password'});
    this.confirmPasswordInput = page.getByRole('textbox', {
      name: 'Confirm Password',
    });
    this.submitButton = page.locator('[data-test="signup-submit"]');
    this.signInLink = page.getByRole('link', {name: /sign in/i});
  }

  async navigate(): Promise<void> {
    await this.page.goto('/signup');
  }

  async fillForm(data: SignupFormData): Promise<void> {
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.usernameInput.fill(data.username);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword);
  }

  async signUp(data: SignupFormData): Promise<void> {
    await this.fillForm(data);
    await this.submitButton.click();
  }

  async signUpAndWait(data: SignupFormData): Promise<void> {
    await this.signUp(data);
    await this.page.waitForURL(url => !url.pathname.includes('/signup'));
  }

  async getFieldError(fieldName: string): Promise<string> {
    const error = this.page
      .locator('p')
      .filter({hasText: new RegExp(fieldName, 'i')});
    await error.waitFor({state: 'visible'});
    return (await error.textContent()) ?? '';
  }
}
