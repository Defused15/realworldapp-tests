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
  readonly validationErrorMessages: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('[data-test="signup-title"]');
    // MUI TextField sets data-test on the wrapper div, not the <input>.
    // Using the id attribute targets the actual <input> element directly.
    this.firstNameInput = page.locator('#firstName');
    this.lastNameInput = page.locator('#lastName');
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.confirmPasswordInput = page.locator('#confirmPassword');
    this.submitButton = page.locator('[data-test="signup-submit"]');
    // "Have an account? Sign In" link — no data-test; role+name is stable and accessible
    this.signInLink = page.getByRole('link', {name: /sign in/i});
    // Generic validation error paragraphs — no data-test on these elements
    this.validationErrorMessages = page
      .locator('p')
      .filter({hasText: /required|must|invalid/i});
  }

  async navigate(): Promise<void> {
    await this.page.goto('/signup');
    await this.submitButton.waitFor({state: 'visible'});
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
