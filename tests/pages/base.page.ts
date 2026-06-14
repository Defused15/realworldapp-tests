import {type Page, type Locator} from '@playwright/test';

export abstract class BasePage {
  // Global nav element present on every authenticated page — used as visual mask
  readonly navNotificationsCount: Locator;

  constructor(protected readonly page: Page) {
    this.navNotificationsCount = page.locator(
      '[data-test="nav-top-notifications-count"]',
    );
  }

  abstract navigate(...args: string[]): Promise<void>;

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('load');
  }
}
