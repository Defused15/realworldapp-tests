import {type Page, type Locator} from '@playwright/test';
import {BasePage} from './base.page';

export class TransactionPage extends BasePage {
  // Navigation anchor — stable, non-dynamic
  readonly transactionDetailHeader: Locator;

  // Static locators (no dynamic ID)
  readonly transactionDescription: Locator;
  readonly commentsList: Locator;
  readonly commentItems: Locator;
  readonly receiverAvatar: Locator;
  readonly senderAvatar: Locator;

  constructor(page: Page) {
    super(page);
    this.transactionDetailHeader = page.locator(
      '[data-test="transaction-detail-header"]',
    );
    this.transactionDescription = page.locator(
      '[data-test="transaction-description"]',
    );
    this.commentsList = page.locator('[data-test="comments-list"]');
    // Comment <li> items — use with expect().toHaveCount() so the assertion
    // auto-retries while the list renders async (a one-shot count() races the
    // render and flakes; see comment-count test).
    this.commentItems = this.commentsList.locator('li');
    this.receiverAvatar = page.locator(
      '[data-test="transaction-receiver-avatar"]',
    );
    this.senderAvatar = page.locator('[data-test="transaction-sender-avatar"]');
  }

  async navigate(txId: string): Promise<void> {
    await this.page.goto(`/transaction/${txId}`);
    await this.transactionDetailHeader.waitFor({state: 'visible'});
    // Wait for the transaction body (amount) to finish rendering — it loads async
    // after the header. Without this, screenshots in parallel runs can capture a
    // partially-loaded page.
    await this.getAmount(txId).waitFor({state: 'visible'});
  }

  // Dynamic locators — accept the transaction ID and return a Locator

  getTransactionItem(txId: string): Locator {
    return this.page.locator(`[data-test="transaction-item-${txId}"]`);
  }

  getSender(txId: string): Locator {
    return this.page.locator(`[data-test="transaction-sender-${txId}"]`);
  }

  getAction(txId: string): Locator {
    return this.page.locator(`[data-test="transaction-action-${txId}"]`);
  }

  getReceiver(txId: string): Locator {
    return this.page.locator(`[data-test="transaction-receiver-${txId}"]`);
  }

  getAmount(txId: string): Locator {
    return this.page.locator(`[data-test="transaction-amount-${txId}"]`);
  }

  getLikeCount(txId: string): Locator {
    return this.page.locator(`[data-test="transaction-like-count-${txId}"]`);
  }

  getLikeButton(txId: string): Locator {
    return this.page.locator(`[data-test="transaction-like-button-${txId}"]`);
  }

  getCommentInput(txId: string): Locator {
    return this.page.locator(`[data-test="transaction-comment-input-${txId}"]`);
  }

  getCommentAt(index: number): Locator {
    return this.commentItems.nth(index);
  }

  async getCommentCount(): Promise<number> {
    return this.commentItems.count();
  }

  // Action methods

  async likeTransaction(txId: string): Promise<void> {
    await this.getLikeButton(txId).click();
  }

  async addComment(txId: string, text: string): Promise<void> {
    const input = this.getCommentInput(txId);
    await input.fill(text);
    await input.press('Enter');
  }

  async getDescriptionText(): Promise<string> {
    return (await this.transactionDescription.innerText()).trim();
  }

  async getLikeCountText(txId: string): Promise<string> {
    return (await this.getLikeCount(txId).innerText()).trim();
  }

  async getAmountText(txId: string): Promise<string> {
    return (await this.getAmount(txId).innerText()).trim();
  }

  async getSenderText(txId: string): Promise<string> {
    return (await this.getSender(txId).innerText()).trim();
  }

  async getActionText(txId: string): Promise<string> {
    return (await this.getAction(txId).innerText()).trim();
  }

  async getReceiverText(txId: string): Promise<string> {
    return (await this.getReceiver(txId).innerText()).trim();
  }

  async isCommentsListVisible(): Promise<boolean> {
    return this.commentsList.isVisible();
  }
}
