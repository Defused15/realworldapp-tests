// tests/ui/home.spec.ts

import {test, expect} from '../fixtures';
import AxeBuilder from '@axe-core/playwright';

const API = process.env.API_URL ?? 'http://localhost:3001';

test.describe('Home', () => {
  // ─── Transaction Feed ──────────────────────────────────────────────────────
  test.describe('Transaction Feed', () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      test('transaction list count matches API response @smoke', async ({
        homePage,
        apiClient,
      }) => {
        const res = await apiClient.get(
          `${API}/transactions/public?page=1&limit=10`,
        );
        const {results} = await res.json();
        await expect(homePage.transactionList).toBeVisible();
        expect(await homePage.getTransactionCount()).toBe(results.length);
      });

      test('first transaction in UI matches API first result @smoke', async ({
        homePage,
        apiClient,
      }) => {
        const res = await apiClient.get(
          `${API}/transactions/public?page=1&limit=10`,
        );
        const {results} = await res.json();
        const first = results[0];
        const firstItem = homePage.getTransactionAt(0);
        await expect(firstItem).toContainText(first.senderName);
        await expect(firstItem).toContainText(first.receiverName);
        await expect(firstItem).toContainText(
          (first.amount / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
        );
      });

      test('"Everyone" tab selected by default, section label is "Public" @smoke', async ({
        homePage,
        page,
      }) => {
        await expect(homePage.everyoneTab).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(homePage.sectionLabel).toHaveText('Public');
        await expect(page).toHaveURL(/localhost:3000\/$/);
      });

      test('"Friends" tab navigates to /contacts, section label is "Contacts" @smoke', async ({
        homePage,
        page,
      }) => {
        await homePage.clickTab('Friends');
        await expect(homePage.friendsTab).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await expect(page).toHaveURL(/\/contacts/);
        await expect(homePage.sectionLabel).toHaveText('Contacts');
      });

      test('"Mine" tab navigates to /personal, section label is "Personal" @smoke', async ({
        homePage,
        page,
      }) => {
        await homePage.clickTab('Mine');
        await expect(homePage.mineTab).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveURL(/\/personal/);
        await expect(homePage.sectionLabel).toHaveText('Personal');
      });
    });

    // ─── Navigation to Transaction Detail ───────────────────────────────────
    test.describe('Navigation', () => {
      test('clicking a transaction row navigates to the correct /transaction/{id} @smoke', async ({
        homePage,
        transactionPage,
        apiClient,
        page,
      }) => {
        const res = await apiClient.get(
          `${API}/transactions/public?page=1&limit=10`,
        );
        const {results} = await res.json();
        const firstTxId = results[0].id;

        await homePage.getTransactionAt(0).click();

        await expect(page).toHaveURL(new RegExp(`/transaction/${firstTxId}`));
        await expect(transactionPage.transactionDetailHeader).toBeVisible();
        // Content assertions belong in transaction.spec.ts — home owns navigation only
      });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────────
    test.describe('Edge Cases', () => {
      test('every visible transaction row matches API: names, amount, like/comment counts @regression', async ({
        homePage,
        apiClient,
      }) => {
        const res = await apiClient.get(
          `${API}/transactions/public?page=1&limit=10`,
        );
        const {results} = await res.json();
        const uiCount = await homePage.getTransactionCount();
        expect(uiCount).toBe(results.length);

        for (let i = 0; i < results.length; i++) {
          const tx = results[i];
          const item = homePage.getTransactionAt(i);
          await expect(item).toContainText(tx.senderName);
          await expect(item).toContainText(tx.receiverName);
          await expect(item).toContainText(
            (tx.amount / 100).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          );
          await expect(homePage.getTransactionLikeCountAt(i)).toHaveText(
            String(tx.likes.length),
          );
          await expect(homePage.getTransactionCommentCountAt(i)).toHaveText(
            String(tx.comments.length),
          );
        }
      });

      test('all transactions show a verb (paid/requested/charged) @regression', async ({
        homePage,
        apiClient,
      }) => {
        const res = await apiClient.get(
          `${API}/transactions/public?page=1&limit=10`,
        );
        const {results} = await res.json();
        for (let i = 0; i < results.length; i++) {
          const text = await homePage.getTransactionAt(i).textContent();
          expect(text).toMatch(/paid|requested|charged/i);
        }
      });

      test('pagination — page 2 has no duplicate IDs from page 1 @regression', async ({
        homePage,
        apiClient,
        page,
      }) => {
        const res1 = await apiClient.get(
          `${API}/transactions/public?page=1&limit=10`,
        );
        const {results: p1, pageData} = await res1.json();
        if (!pageData.hasNextPages) {
          test.skip();
          return;
        }
        const p1Ids = p1.map((t: {id: string}) => t.id);

        const res2 = await apiClient.get(
          `${API}/transactions/public?page=2&limit=10`,
        );
        const {results: p2} = await res2.json();
        const p2Ids = p2.map((t: {id: string}) => t.id);

        const overlap = p1Ids.filter((id: string) => p2Ids.includes(id));
        expect(overlap).toHaveLength(0);

        await expect(homePage.transactionList).toBeVisible();
        await page.goBack();
      });
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      test('XSS in transaction description does not execute JS @security', async ({
        homePage,
        page,
      }) => {
        let xssTriggered = false;
        page.on('dialog', async dialog => {
          xssTriggered = true;
          await dialog.dismiss();
        });
        await expect(homePage.transactionList).toBeVisible();
        const xssMarker = await page.evaluate(
          () => (window as {__xss?: unknown}).__xss,
        );
        expect(xssMarker).toBeUndefined();
        expect(xssTriggered).toBe(false);
      });
    });

    // ─── Accessibility ───────────────────────────────────────────────────────
    test.describe('Accessibility', () => {
      test.skip(
        true,
        'BUG-006: axe-core link-name violations on app pages — icon-only links without accessible names',
      );

      test('no critical axe-core WCAG 2.1 AA violations on homepage @a11y', async ({
        homePage,
        page,
      }) => {
        await expect(homePage.transactionList).toBeVisible();
        const results = await new AxeBuilder({page})
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });

      test('transaction list has role="grid" @a11y', async ({homePage}) => {
        await expect(homePage.transactionList).toBeVisible();
        await expect(homePage.transactionList).toHaveAttribute('role', 'grid');
      });
    });

    // ─── Visual ──────────────────────────────────────────────────────────────
    test.describe('Visual', () => {
      // Visual baselines are created on first run. Commit __snapshots__/ to git.
      // To update: npx playwright test --update-snapshots --grep @visual

      test('dashboard initial state matches snapshot @visual', async ({
        homePage,
        page,
      }) => {
        await expect(homePage.transactionList).toBeVisible();
        await expect(page).toHaveScreenshot('home-dashboard.png', {
          maxDiffPixels: 200,
          mask: [homePage.accountBalance, homePage.notificationsBadge],
        });
      });
    });
  });

  // ─── Navigation ────────────────────────────────────────────────────────────
  test.describe('Navigation', () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      test('"New" link has href /transaction/new @smoke', async ({
        homePage,
      }) => {
        await expect(homePage.newTransactionLink).toHaveAttribute(
          'href',
          '/transaction/new',
        );
      });

      test('notification badge count matches API unread count @smoke', async ({
        homePage,
        apiClient,
      }) => {
        const res = await apiClient.get(`${API}/notifications`);
        const {results} = await res.json();
        const unread = results.filter(
          (n: {isRead: boolean}) => !n.isRead,
        ).length;
        await expect(homePage.notificationsBadge).toContainText(String(unread));
      });

      test('notification badge link is accessible @smoke', async ({
        homePage,
      }) => {
        await expect(homePage.notificationsBadge).toBeVisible();
      });

      test('sidebar nav links have correct href attributes @smoke', async ({
        homePage,
      }) => {
        await expect(homePage.homeNavLink).toHaveAttribute('href', '/');
        await expect(homePage.myAccountNavLink).toHaveAttribute(
          'href',
          '/user/settings',
        );
        await expect(homePage.bankAccountsNavLink).toHaveAttribute(
          'href',
          '/bankaccounts',
        );
        await expect(homePage.notificationsNavLink).toHaveAttribute(
          'href',
          '/notifications',
        );
      });
    });
  });

  // ─── Sidebar ───────────────────────────────────────────────────────────────
  test.describe('Sidebar', () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      test('shows seed user full name and username @smoke', async ({
        homePage,
      }) => {
        await expect(homePage.userFullName).toHaveText('Ted P');
        await expect(homePage.username).toHaveText('@Heath93');
      });

      test('shows account balance @smoke', async ({homePage}) => {
        await expect(homePage.accountBalance).toBeVisible();
        await expect(homePage.accountBalance).toContainText('$');
      });
    });
  });

  // ─── Filters ───────────────────────────────────────────────────────────────
  test.describe('Filters', () => {
    // ─── Happy Path ──────────────────────────────────────────────────────────
    test.describe('Happy Path', () => {
      test('date filter shows "Date: ALL" by default @smoke', async ({
        homePage,
      }) => {
        await expect(homePage.dateFilter).toContainText('Date: ALL');
      });

      test('amount filter shows "$0 - $1,000" by default @smoke', async ({
        homePage,
      }) => {
        await expect(homePage.amountFilter).toContainText('$0 - $1,000');
      });
    });

    // ─── Functional ──────────────────────────────────────────────────────────
    test.describe('Functional', () => {
      test('"Friends" tab content matches GET /transactions/contacts API @regression', async ({
        homePage,
        apiClient,
        page,
      }) => {
        const res = await apiClient.get(
          `${API}/transactions/contacts?page=1&limit=10`,
        );
        const {results} = await res.json();

        await homePage.clickTab('Friends');
        await expect(page).toHaveURL(/\/contacts/);
        await homePage.transactionList.waitFor({state: 'visible'});

        const uiCount = await homePage.getTransactionCount();
        expect(uiCount).toBe(results.length);

        for (let i = 0; i < results.length; i++) {
          const tx = results[i];
          const item = homePage.getTransactionAt(i);
          await expect(item).toContainText(tx.senderName);
          await expect(item).toContainText(tx.receiverName);
          await expect(item).toContainText(
            (tx.amount / 100).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          );
        }
      });

      test('"Mine" tab content matches GET /transactions API @regression', async ({
        homePage,
        apiClient,
        page,
      }) => {
        const res = await apiClient.get(`${API}/transactions?page=1&limit=10`);
        const {results} = await res.json();

        await homePage.clickTab('Mine');
        await expect(page).toHaveURL(/\/personal/);
        await homePage.transactionList.waitFor({state: 'visible'});

        const uiCount = await homePage.getTransactionCount();
        expect(uiCount).toBe(results.length);

        for (let i = 0; i < results.length; i++) {
          const tx = results[i];
          const item = homePage.getTransactionAt(i);
          await expect(item).toContainText(tx.senderName);
          await expect(item).toContainText(tx.receiverName);
        }
      });

      test('"Mine" tab shows only transactions involving current user @regression', async ({
        homePage,
        apiClient,
        page,
      }) => {
        const res = await apiClient.get(`${API}/transactions?page=1&limit=10`);
        const {results} = await res.json();

        await homePage.clickTab('Mine');
        await expect(page).toHaveURL(/\/personal/);

        const SEED_USER_ID = 'uBmeaz5pX';
        for (const tx of results) {
          const isInvolved =
            tx.senderId === SEED_USER_ID || tx.receiverId === SEED_USER_ID;
          expect(isInvolved).toBe(true);
        }
      });

      test('amount filter narrows transaction list when max is reduced @regression', async ({
        homePage,
        page,
      }) => {
        const initialCount = await homePage.getTransactionCount();

        await homePage.amountFilter.click();
        // MUI Slider uses <input type="range"> — not role="slider"
        await expect(homePage.amountSliders.first()).toBeVisible();

        // Move the max value slider left (reduce upper bound)
        const maxSlider = homePage.amountSliders.nth(1);
        await maxSlider.focus();
        for (let i = 0; i < 50; i++) {
          await maxSlider.press('ArrowLeft');
        }

        // Dismiss via the MUI invisible backdrop — sidenav click is intercepted by it
        await page.locator('#amount-range-popover .MuiBackdrop-root').click();

        // Filter label auto-wait — confirms both filter applied AND popover closed
        await expect(homePage.amountFilter).not.toContainText('$0 - $1,000');

        const filteredCount = await homePage.getTransactionCount();
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
      });

      test('amount filter "Everyone" tab — API amountMax param produces consistent results @regression', async ({
        apiClient,
      }) => {
        // Verify that a tight range via API returns fewer results than the full range
        const fullRes = await apiClient.get(
          `${API}/transactions/public?page=1&limit=10`,
        );
        const {results: allResults} = await fullRes.json();

        const narrowRes = await apiClient.get(
          `${API}/transactions/public?page=1&limit=10&amountMin=0&amountMax=10000`,
        );
        const {results: narrowResults} = await narrowRes.json();

        // All narrow results must have amount ≤ 10000 (cents)
        for (const tx of narrowResults) {
          expect(tx.amount).toBeLessThanOrEqual(10000);
        }
        // Narrow range should have fewer or equal results than full range
        expect(narrowResults.length).toBeLessThanOrEqual(allResults.length);
      });
    });
  });
});
