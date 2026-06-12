import {type Page} from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  abstract navigate(...args: string[]): Promise<void>;

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}
