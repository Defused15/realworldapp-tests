import {type Page, type Locator} from '@playwright/test';
import {BasePage} from './base.page';

export class HomePage extends BasePage {
  // Top bar
  readonly openDrawerButton: Locator;
  readonly newTransactionLink: Locator;
  readonly notificationsBadge: Locator;

  // Transaction feed
  readonly everyoneTab: Locator;
  readonly friendsTab: Locator;
  readonly mineTab: Locator;
  readonly transactionList: Locator;
  readonly transactionItems: Locator;
  readonly sectionLabel: Locator;

  // Filters
  readonly dateFilter: Locator;
  readonly amountFilter: Locator;
  readonly amountSliders: Locator;
  readonly sidenav: Locator;

  // Sidebar
  readonly userFullName: Locator;
  readonly username: Locator;
  readonly accountBalance: Locator;
  readonly logoutButton: Locator;
  readonly homeNavLink: Locator;
  readonly myAccountNavLink: Locator;
  readonly bankAccountsNavLink: Locator;
  readonly notificationsNavLink: Locator;

  constructor(page: Page) {
    super(page);

    // Top bar — all have stable data-test attrs in NavBar.tsx
    this.openDrawerButton = page.locator('[data-test="sidenav-toggle"]');
    this.newTransactionLink = page.locator(
      '[data-test="nav-top-new-transaction"]',
    );
    this.notificationsBadge = page.locator(
      '[data-test="nav-top-notifications-count"]',
    );

    // Tabs — no data-test; role is stable
    this.everyoneTab = page.getByRole('tab', {name: 'Everyone'});
    this.friendsTab = page.getByRole('tab', {name: 'Friends'});
    this.mineTab = page.getByRole('tab', {name: 'Mine'});

    // Transaction list
    this.transactionList = page.getByRole('grid');
    this.transactionItems = page.getByRole('grid').getByRole('listitem');
    this.sectionLabel = page
      .locator('main div')
      .filter({hasText: /^(Public|Contacts|Personal)$/})
      .first();

    // Filters — both have stable data-test attributes in TransactionListFilters.tsx
    this.dateFilter = page.locator(
      '[data-test="transaction-list-filter-date-range-button"]',
    );
    this.amountFilter = page.locator(
      '[data-test="transaction-list-filter-amount-range-button"]',
    );
    // MUI Slider renders <input type="range"> — not role="slider" — inside the slider container
    this.amountSliders = page.locator(
      '[data-test="transaction-list-filter-amount-range-slider"] input[type="range"]',
    );
    this.sidenav = page.locator('[data-test="sidenav"]');

    // Sidebar — all have stable data-test attrs in NavDrawer.tsx
    this.userFullName = page.locator('[data-test="sidenav-user-full-name"]');
    this.username = page.locator('[data-test="sidenav-username"]');
    this.accountBalance = page.locator('[data-test="sidenav-user-balance"]');
    this.logoutButton = page.locator('[data-test="sidenav-signout"]');
    this.homeNavLink = page.locator('[data-test="sidenav-home"]');
    this.myAccountNavLink = page.locator('[data-test="sidenav-user-settings"]');
    this.bankAccountsNavLink = page.locator(
      '[data-test="sidenav-bankaccounts"]',
    );
    this.notificationsNavLink = page.locator(
      '[data-test="sidenav-notifications"]',
    );
  }

  async navigate(): Promise<void> {
    await this.page.goto('/');
    await this.transactionList.waitFor({state: 'visible'});
  }

  async clickTab(name: 'Everyone' | 'Friends' | 'Mine'): Promise<void> {
    await this.page.getByRole('tab', {name}).click();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  async getTransactionCount(): Promise<number> {
    return this.transactionItems.count();
  }

  getTransactionAt(index: number): Locator {
    return this.transactionItems.nth(index);
  }

  getTransactionLikeCountAt(index: number): Locator {
    return this.getTransactionAt(index)
      .locator('p')
      .filter({hasText: /^\d+$/})
      .nth(0);
  }

  getTransactionCommentCountAt(index: number): Locator {
    return this.getTransactionAt(index)
      .locator('p')
      .filter({hasText: /^\d+$/})
      .nth(1);
  }
}
