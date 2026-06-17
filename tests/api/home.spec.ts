import {test, expect} from '@playwright/test';
import {loginAs, createUser} from '../helpers/api-helpers';
import seedUsers from '../data/seed-users.json';

const SEED_USER = seedUsers[0]; // Heath93 / s3cret

const CREDS = {
  username: process.env.TEST_USER_USERNAME!,
  password: process.env.TEST_USER_PASSWORD!,
};

const GQL_LIST_BANK_ACCOUNT = {
  operationName: 'ListBankAccount',
  query:
    'query ListBankAccount { listBankAccount { id uuid userId bankName accountNumber routingNumber isDeleted createdAt modifiedAt } }',
};

test.describe('home API', () => {
  // ─── GET /transactions/public ──────────────────────────────────────────────
  test.describe('GET /transactions/public', () => {
    // ─── Functional ──────────────────────────────────────────────────────────
    test.describe('Functional', () => {
      test('returns 200 with paginated results for authenticated user @smoke', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.get('/transactions/public?page=1&limit=10');
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toMatch(/application\/json/);
        const body = await res.json();
        expect(body).toHaveProperty('pageData');
        expect(body).toHaveProperty('results');
        expect(Array.isArray(body.results)).toBe(true);
      });

      test('pageData has page=1, limit=10 and results.length <= 10 @smoke', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.get('/transactions/public?page=1&limit=10');
        const body = await res.json();
        expect(body.pageData.page).toBe(1);
        expect(body.pageData.limit).toBe(10);
        expect(body.results.length).toBeLessThanOrEqual(10);
      });

      test('page=2 returns a valid response with different page indicator @regression', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.get('/transactions/public?page=2&limit=10');
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('pageData');
        expect(body.pageData.page).toBe(2);
      });

      test('supports dateStart and dateEnd query params @regression', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.get(
          '/transactions/public?page=1&limit=10&dateStart=2020-01-01&dateEnd=2030-12-31',
        );
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('results');
      });

      test('supports amountMin and amountMax query params @regression', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.get(
          '/transactions/public?page=1&limit=10&amountMin=0&amountMax=999999',
        );
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('results');
      });

      test('returns 401 or redirect for unauthenticated request @regression', async ({
        request,
      }) => {
        const res = await request.get('/transactions/public?page=1&limit=10');
        expect([401, 302]).toContain(res.status());
      });
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      test('without auth returns 401 or redirect @security', async ({
        request,
      }) => {
        const res = await request.get('/transactions/public?page=1&limit=10');
        expect([401, 302]).toContain(res.status());
      });

      test('random connect.sid cookie is rejected @security', async ({
        request,
      }) => {
        const res = await request.get('/transactions/public?page=1&limit=10', {
          headers: {
            Cookie:
              'connect.sid=s%3Afake-invalid-session-id-randomvalue12345.fakesig',
          },
        });
        expect([401, 302]).toContain(res.status());
      });

      test('SQL injection in query params does not cause 500 @security', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.get(
          "/transactions/public?page=1'; DROP TABLE transactions--&limit=10",
        );
        expect(res.status()).not.toBe(500);
      });

      test('IDOR: user B cannot read user A private transactions @security', async ({
        browser,
      }) => {
        const ctxA = await browser.newContext();
        const ctxB = await browser.newContext();
        const reqA = ctxA.request;
        const reqB = ctxB.request;

        try {
          await loginAs(reqA, {
            username: SEED_USER.username,
            password: process.env.TEST_USER_PASSWORD!,
          });
          const {data: userBData, userId: userBId} = await createUser(reqB);
          await loginAs(reqB, {
            username: userBData.username,
            password: userBData.password,
          });

          const resB = await reqB.get('/transactions?page=1&limit=10');
          expect([200, 401, 403, 302]).toContain(resB.status());

          if (resB.status() === 200) {
            const body = await resB.json();
            const results = (body.results ?? body.transactions ?? []) as Array<
              Record<string, unknown>
            >;
            for (const tx of results) {
              const isBInvolved =
                tx['senderId'] === userBId || tx['receiverId'] === userBId;
              if (!isBInvolved && tx['privacyLevel'] === 'private') {
                expect(tx['senderId']).toBe(userBId);
              }
            }
          }
        } finally {
          await ctxA.close();
          await ctxB.close();
        }
      });
    });

    // ─── Contract ────────────────────────────────────────────────────────────
    test.describe('Contract', () => {
      let body!: Record<string, unknown>;

      test.beforeAll(async ({request}) => {
        await loginAs(request, CREDS);
        const res = await request.get('/transactions/public?page=1&limit=10');
        body = await res.json();
      });

      test('has pageData object @contract', () => {
        expect(body).toHaveProperty('pageData');
        expect(typeof body['pageData']).toBe('object');
      });

      test('pageData.page is a number @contract', () => {
        const pageData = body['pageData'] as Record<string, unknown>;
        expect(typeof pageData['page']).toBe('number');
      });

      test('pageData.limit is a number @contract', () => {
        const pageData = body['pageData'] as Record<string, unknown>;
        expect(typeof pageData['limit']).toBe('number');
      });

      test('pageData.hasNextPages is a boolean @contract', () => {
        const pageData = body['pageData'] as Record<string, unknown>;
        expect(typeof pageData['hasNextPages']).toBe('boolean');
      });

      test('pageData.totalPages is a number @contract', () => {
        const pageData = body['pageData'] as Record<string, unknown>;
        expect(typeof pageData['totalPages']).toBe('number');
      });

      test('has results array @contract', () => {
        expect(body).toHaveProperty('results');
        expect(Array.isArray(body['results'])).toBe(true);
      });

      test('results[0] has all required transaction fields @contract', () => {
        const results = body['results'] as Array<Record<string, unknown>>;
        if (results.length === 0) return;
        const tx = results[0];
        expect(typeof tx['id']).toBe('string');
        expect(typeof tx['uuid']).toBe('string');
        expect(typeof tx['receiverName']).toBe('string');
        expect(typeof tx['senderName']).toBe('string');
        expect(typeof tx['amount']).toBe('number');
        expect(typeof tx['description']).toBe('string');
        expect(typeof tx['privacyLevel']).toBe('string');
        expect(typeof tx['status']).toBe('string');
        // requestStatus is optional: request-type transactions carry a string
        // ('pending'|'accepted'|'rejected'), payment-type transactions omit it
        // entirely (seed data stores '' but the runtime serializer drops it).
        // results[0] is the newest tx, so a payment created by another test can
        // surface here — assert it's a string only when present.
        if (tx['requestStatus'] !== undefined) {
          expect(typeof tx['requestStatus']).toBe('string');
        }
        expect(typeof tx['createdAt']).toBe('string');
        expect(typeof tx['modifiedAt']).toBe('string');
      });

      test('results[0].createdAt is a valid ISO date @contract', () => {
        const results = body['results'] as Array<Record<string, unknown>>;
        if (results.length === 0) return;
        const val = results[0]['createdAt'] as string;
        expect(new Date(val).toISOString()).toBe(val);
      });

      test('results[0].uuid matches UUID format @contract', () => {
        const results = body['results'] as Array<Record<string, unknown>>;
        if (results.length === 0) return;
        expect(results[0]['uuid'] as string).toMatch(/^[0-9a-f-]{36}$/);
      });
    });

    // ─── Performance ─────────────────────────────────────────────────────────
    test.describe('Performance', () => {
      test('responds within 500ms @performance', async ({request}) => {
        await loginAs(request, CREDS);
        await request.get('/transactions/public?page=1&limit=10');
        const start = Date.now();
        const res = await request.get('/transactions/public?page=1&limit=10');
        const duration = Date.now() - start;
        expect(res.status()).toBe(200);
        expect(duration).toBeLessThan(500);
      });
    });
  });

  // ─── GET /notifications ────────────────────────────────────────────────────
  test.describe('GET /notifications', () => {
    // ─── Functional ──────────────────────────────────────────────────────────
    test.describe('Functional', () => {
      test('returns 200 with results array for authenticated user @smoke', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.get('/notifications');
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toMatch(/application\/json/);
        const body = await res.json();
        expect(body).toHaveProperty('results');
        expect(Array.isArray(body.results)).toBe(true);
      });

      test('each notification has required fields @smoke', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.get('/notifications');
        const body = await res.json();
        if (body.results.length > 0) {
          const n = body.results[0] as Record<string, unknown>;
          expect(n).toHaveProperty('id');
          expect(n).toHaveProperty('uuid');
          expect(n).toHaveProperty('userId');
          expect(n).toHaveProperty('transactionId');
          expect(n).toHaveProperty('isRead');
          expect(n).toHaveProperty('userFullName');
          expect(n).toHaveProperty('createdAt');
        }
      });

      test('returns 401 or redirect for unauthenticated request @regression', async ({
        request,
      }) => {
        const res = await request.get('/notifications');
        expect([401, 302]).toContain(res.status());
      });
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      test('without auth returns 401 or redirect @security', async ({
        request,
      }) => {
        const res = await request.get('/notifications');
        expect([401, 302]).toContain(res.status());
      });
    });

    // ─── Contract ────────────────────────────────────────────────────────────
    test.describe('Contract', () => {
      let body!: Record<string, unknown>;

      test.beforeAll(async ({request}) => {
        await loginAs(request, CREDS);
        const res = await request.get('/notifications');
        body = await res.json();
      });

      test('has results array @contract', () => {
        expect(body).toHaveProperty('results');
        expect(Array.isArray(body['results'])).toBe(true);
      });

      test('results[0] has all required notification fields @contract', () => {
        const results = body['results'] as Array<Record<string, unknown>>;
        if (results.length === 0) return;
        const n = results[0];
        expect(typeof n['id']).toBe('string');
        expect(typeof n['uuid']).toBe('string');
        expect(typeof n['userId']).toBe('string');
        expect(typeof n['transactionId']).toBe('string');
        expect(typeof n['isRead']).toBe('boolean');
        expect(typeof n['userFullName']).toBe('string');
        expect(typeof n['createdAt']).toBe('string');
        expect(typeof n['modifiedAt']).toBe('string');
      });

      test('results[0].uuid matches UUID format @contract', () => {
        const results = body['results'] as Array<Record<string, unknown>>;
        if (results.length === 0) return;
        expect(results[0]['uuid'] as string).toMatch(/^[0-9a-f-]{36}$/);
      });

      test('results[0].createdAt is a valid ISO date @contract', () => {
        const results = body['results'] as Array<Record<string, unknown>>;
        if (results.length === 0) return;
        const val = results[0]['createdAt'] as string;
        expect(new Date(val).toISOString()).toBe(val);
      });

      test('unread count is consistent: read + unread = total, and seed has unread @contract', () => {
        const results = body['results'] as Array<Record<string, unknown>>;
        const unread = results.filter(n => n['isRead'] === false);
        const read = results.filter(n => n['isRead'] === true);
        expect(unread.length + read.length).toBe(results.length);
        expect(unread.length).toBeGreaterThan(0);
      });
    });

    // ─── Performance ─────────────────────────────────────────────────────────
    test.describe('Performance', () => {
      test('responds within 500ms @performance', async ({request}) => {
        await loginAs(request, CREDS);
        await request.get('/notifications');
        const start = Date.now();
        const res = await request.get('/notifications');
        const duration = Date.now() - start;
        expect(res.status()).toBe(200);
        expect(duration).toBeLessThan(500);
      });
    });
  });

  // ─── POST /graphql (ListBankAccount) ───────────────────────────────────────
  test.describe('POST /graphql (ListBankAccount)', () => {
    // ─── Functional ──────────────────────────────────────────────────────────
    test.describe('Functional', () => {
      test('returns 200 with data.listBankAccount array for authenticated user @smoke', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.post('/graphql', {
          data: GQL_LIST_BANK_ACCOUNT,
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('listBankAccount');
        expect(Array.isArray(body.data.listBankAccount)).toBe(true);
      });

      test('each bank account has required fields @smoke', async ({
        request,
      }) => {
        await loginAs(request, CREDS);
        const res = await request.post('/graphql', {
          data: GQL_LIST_BANK_ACCOUNT,
        });
        const body = await res.json();
        if (body.data.listBankAccount.length > 0) {
          const acct = body.data.listBankAccount[0] as Record<string, unknown>;
          expect(acct).toHaveProperty('id');
          expect(acct).toHaveProperty('uuid');
          expect(acct).toHaveProperty('userId');
          expect(acct).toHaveProperty('bankName');
          expect(acct).toHaveProperty('accountNumber');
          expect(acct).toHaveProperty('routingNumber');
          expect(acct).toHaveProperty('isDeleted');
        }
      });

      test('returns error or 401 for unauthenticated request @regression', async ({
        request,
      }) => {
        const res = await request.post('/graphql', {
          data: GQL_LIST_BANK_ACCOUNT,
        });
        if (res.status() === 200) {
          const body = await res.json();
          const hasErrors = body.errors !== null && body.errors !== undefined;
          const hasNullData =
            body.data === null ||
            body.data === undefined ||
            body.data.listBankAccount === null ||
            body.data.listBankAccount === undefined;
          expect(hasErrors || hasNullData).toBe(true);
        } else {
          expect([401, 302]).toContain(res.status());
        }
      });
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      test('without auth returns error or 401 @security', async ({request}) => {
        const res = await request.post('/graphql', {
          data: GQL_LIST_BANK_ACCOUNT,
        });
        if (res.status() === 200) {
          const body = await res.json();
          const hasErrors = body.errors !== null && body.errors !== undefined;
          const hasNullData =
            body.data === null ||
            body.data === undefined ||
            body.data.listBankAccount === null ||
            body.data.listBankAccount === undefined;
          expect(hasErrors || hasNullData).toBe(true);
        } else {
          expect([401, 302]).toContain(res.status());
        }
      });
    });

    // ─── Contract ────────────────────────────────────────────────────────────
    test.describe('Contract', () => {
      let body!: Record<string, unknown>;

      test.beforeAll(async ({request}) => {
        await loginAs(request, CREDS);
        const res = await request.post('/graphql', {
          data: GQL_LIST_BANK_ACCOUNT,
        });
        body = await res.json();
      });

      test('has data.listBankAccount array @contract', () => {
        expect(body).toHaveProperty('data');
        const data = body['data'] as Record<string, unknown>;
        expect(data).toHaveProperty('listBankAccount');
        expect(Array.isArray(data['listBankAccount'])).toBe(true);
      });

      test('listBankAccount[0] has all required fields @contract', () => {
        const data = body['data'] as Record<string, unknown>;
        const accounts = data['listBankAccount'] as Array<
          Record<string, unknown>
        >;
        if (accounts.length === 0) return;
        const acct = accounts[0];
        expect(typeof acct['id']).toBe('string');
        expect(typeof acct['uuid']).toBe('string');
        expect(typeof acct['userId']).toBe('string');
        expect(typeof acct['bankName']).toBe('string');
        expect(typeof acct['accountNumber']).toBe('string');
        expect(typeof acct['routingNumber']).toBe('string');
        expect(typeof acct['isDeleted']).toBe('boolean');
      });

      test('listBankAccount[0].uuid matches UUID format @contract', () => {
        const data = body['data'] as Record<string, unknown>;
        const accounts = data['listBankAccount'] as Array<
          Record<string, unknown>
        >;
        if (accounts.length === 0) return;
        expect(accounts[0]['uuid'] as string).toMatch(/^[0-9a-f-]{36}$/);
      });

      test('listBankAccount[0].userId matches seed user id @contract', () => {
        const data = body['data'] as Record<string, unknown>;
        const accounts = data['listBankAccount'] as Array<
          Record<string, unknown>
        >;
        if (accounts.length === 0) return;
        for (const acct of accounts) {
          expect(acct['userId']).toBe(SEED_USER.id);
        }
      });
    });

    // ─── Performance ─────────────────────────────────────────────────────────
    test.describe('Performance', () => {
      test('responds within 500ms @performance', async ({request}) => {
        await loginAs(request, CREDS);
        await request.post('/graphql', {data: GQL_LIST_BANK_ACCOUNT});
        const start = Date.now();
        const res = await request.post('/graphql', {
          data: GQL_LIST_BANK_ACCOUNT,
        });
        const duration = Date.now() - start;
        expect(res.status()).toBe(200);
        expect(duration).toBeLessThan(500);
      });
    });
  });
});
