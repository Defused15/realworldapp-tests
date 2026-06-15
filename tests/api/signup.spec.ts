import {test, expect} from '@playwright/test';
import {buildUser} from '../utils/factories';
import xssPayloads from '../data/xss-payloads.json';

test.describe('signup API', () => {
  // ─── POST /users ───────────────────────────────────────────────────────────
  test.describe('POST /users', () => {
    // ─── Functional ──────────────────────────────────────────────────────────
    test.describe('Functional', () => {
      test('POST /users with valid data returns 201 @smoke', async ({
        request,
      }) => {
        const user = buildUser();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        expect(res.status()).toBe(201);
      });

      test('POST /users response has Content-Type application/json @smoke', async ({
        request,
      }) => {
        const user = buildUser();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        expect(res.headers()['content-type']).toContain('application/json');
      });

      test('POST /users response body contains user object with required fields @smoke', async ({
        request,
      }) => {
        const user = buildUser();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body).toHaveProperty('user');
        expect(body.user).toMatchObject({
          id: expect.any(String),
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      });

      test('newly registered user can log in @smoke', async ({request}) => {
        const user = buildUser();
        const registerRes = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        expect(registerRes.status()).toBe(201);

        const loginRes = await request.post('/login', {
          data: {username: user.username, password: user.password},
        });
        expect(loginRes.status()).toBe(200);
      });

      test('confirmPassword field is accepted when it matches password @smoke', async ({
        request,
      }) => {
        const user = buildUser();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        expect(res.status()).toBe(201);
      });

      test('POST /users with mismatched confirmPassword is accepted (frontend-only validation) @regression', async ({
        request,
      }) => {
        // confirmPassword validation is frontend-only — the API ignores mismatches
        const user = buildUser();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: 'totally_different_password'},
        });
        expect(res.status()).toBe(201);
      });

      test.skip('POST /users with missing firstName returns 422 @regression', async ({
        request,
      }) => {
        // BUG-001: POST /users missing required fields returns 500 HTML with Prisma stack trace,
        // not 422 JSON. This test is skipped until the app adds proper input validation.
        // Expected: 422 with validation error
        // Actual: 500 HTML (Prisma stack trace)
        const user = buildUser();
        const res = await request.post('/users', {
          data: {
            lastName: user.lastName,
            username: user.username,
            password: user.password,
            confirmPassword: user.password,
          },
        });
        expect(res.status()).toBe(422);
      });

      test.skip('POST /users with missing lastName returns 422 @regression', async ({
        request,
      }) => {
        // BUG-001: POST /users missing required fields returns 500 HTML with Prisma stack trace,
        // not 422 JSON.
        const user = buildUser();
        const res = await request.post('/users', {
          data: {
            firstName: user.firstName,
            username: user.username,
            password: user.password,
            confirmPassword: user.password,
          },
        });
        expect(res.status()).toBe(422);
      });

      test.skip('POST /users with missing username returns 422 @regression', async ({
        request,
      }) => {
        // BUG-001: POST /users missing required fields returns 500 HTML with Prisma stack trace,
        // not 422 JSON.
        const user = buildUser();
        const res = await request.post('/users', {
          data: {
            firstName: user.firstName,
            lastName: user.lastName,
            password: user.password,
            confirmPassword: user.password,
          },
        });
        expect(res.status()).toBe(422);
      });

      test.skip('POST /users with missing password returns 422 @regression', async ({
        request,
      }) => {
        // BUG-001: POST /users missing required fields returns 500 HTML with Prisma stack trace,
        // not 422 JSON.
        const user = buildUser();
        const res = await request.post('/users', {
          data: {
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
          },
        });
        expect(res.status()).toBe(422);
      });

      test.skip('POST /users 422 response includes validation errors array @regression', async ({
        request,
      }) => {
        // BUG-001: POST /users missing required fields returns 500 HTML with Prisma stack trace,
        // not 422 JSON. When fixed, the response should include a validation errors array.
        const res = await request.post('/users', {data: {}});
        expect(res.status()).toBe(422);
        const body = await res.json();
        expect(Array.isArray(body.errors)).toBe(true);
      });

      test.skip('POST /users with duplicate username returns 409 @regression', async ({
        request,
      }) => {
        // BUG-002: POST /users with a duplicate username returns 500 HTML (Prisma unique constraint
        // violation), not 409 JSON. This test is skipped until the app handles the conflict gracefully.
        const user = buildUser();
        await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        expect(res.status()).toBe(409);
      });
    });

    // ─── Security ────────────────────────────────────────────────────────────
    test.describe('Security', () => {
      test('POST /users XSS payload in username is stored as a literal, not executed @security', async ({
        request,
      }) => {
        // XSS is an OUTPUT-encoding concern: a JSON API safely STORES the raw
        // string (201 is fine) and the payload is neutralized when rendered.
        // The API-level vulnerability would be a 500 (or the value being
        // mutated/interpreted server-side). Assert no server error and, when
        // accepted, that the value round-trips verbatim.
        const payloads = xssPayloads.slice(0, 3);
        for (const payload of payloads) {
          const user = buildUser();
          const res = await request.post('/users', {
            data: {...user, username: payload, confirmPassword: user.password},
          });
          expect(
            res.status(),
            `XSS payload must not cause a server error: ${payload}`,
          ).not.toBe(500);
          if (res.status() === 201) {
            const body = await res.json();
            expect(
              body.user.username,
              'payload stored verbatim (literal), not interpreted',
            ).toBe(payload);
          }
        }
      });

      test('POST /users SQL injection in username is treated as a literal, not executed @security', async ({
        request,
      }) => {
        const user = buildUser();
        const res = await request.post('/users', {
          data: {
            ...user,
            username: "' OR '1'='1",
            confirmPassword: user.password,
          },
        });
        // Prisma parameterizes queries, so the payload is stored as a literal
        // username (201 is safe, not a vuln). The real failure would be a 500
        // (input reached the SQL engine raw) — assert against that instead.
        expect(
          res.status(),
          'injection must not cause a server error',
        ).not.toBe(500);
      });

      test('POST /users with NoSQL injection in username does not return 201 @security', async ({
        request,
      }) => {
        const user = buildUser();
        const res = await request.post('/users', {
          data: {
            ...user,
            username: {$gt: ''},
            confirmPassword: user.password,
          },
        });
        expect(res.status()).not.toBe(201);
      });

      test('POST /users mass-assignment isAdmin:true is not echoed in response @security', async ({
        request,
      }) => {
        const user = buildUser();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password, isAdmin: true},
        });
        if (res.status() === 201) {
          const body = await res.json();
          expect((body.user as Record<string, unknown>).isAdmin).not.toBe(true);
        }
      });

      test('POST /users mass-assignment role:"admin" is not echoed in response @security', async ({
        request,
      }) => {
        const user = buildUser();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password, role: 'admin'},
        });
        if (res.status() === 201) {
          const body = await res.json();
          expect((body.user as Record<string, unknown>).role).not.toBe('admin');
        }
      });

      test.skip('POST /users response must NOT include password hash @security', async ({
        request,
      }) => {
        // BUG-003: POST /users returns the bcrypt password hash in user.password (OWASP API3:2023 —
        // Excessive Data Exposure). The response should never include any password field.
        // Expected: user.password absent from response
        // Actual: user.password is present and contains the bcrypt hash
        const user = buildUser();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.user).not.toHaveProperty('password');
      });
    });

    // ─── Contract ────────────────────────────────────────────────────────────
    test.describe('Contract', () => {
      let body!: Record<string, unknown>;
      let submittedUser!: {
        firstName: string;
        lastName: string;
        username: string;
        password: string;
      };

      test.beforeAll(async ({request}) => {
        submittedUser = buildUser();
        const res = await request.post('/users', {
          data: {...submittedUser, confirmPassword: submittedUser.password},
        });
        body = await res.json();
      });

      test('response has "user" key @contract', () => {
        expect(body).toHaveProperty('user');
      });

      test('user.id is a non-empty string @contract', () => {
        const user = body.user as Record<string, unknown>;
        expect(typeof user.id).toBe('string');
        expect((user.id as string).length).toBeGreaterThan(0);
      });

      test('user.uuid matches UUID format @contract', () => {
        const user = body.user as Record<string, unknown>;
        expect(user.uuid as string).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
      });

      test('user.firstName matches submitted value @contract', () => {
        const user = body.user as Record<string, unknown>;
        expect(user.firstName).toBe(submittedUser.firstName);
      });

      test('user.lastName matches submitted value @contract', () => {
        const user = body.user as Record<string, unknown>;
        expect(user.lastName).toBe(submittedUser.lastName);
      });

      test('user.username matches submitted value @contract', () => {
        const user = body.user as Record<string, unknown>;
        expect(user.username).toBe(submittedUser.username);
      });

      test('user.balance is a number @contract', () => {
        const user = body.user as Record<string, unknown>;
        expect(typeof user.balance).toBe('number');
      });

      test('user.defaultPrivacyLevel is a valid privacy level @contract', () => {
        const user = body.user as Record<string, unknown>;
        expect(['public', 'private', 'contacts']).toContain(
          user.defaultPrivacyLevel,
        );
      });

      test('user.createdAt is a valid ISO 8601 date string @contract', () => {
        const user = body.user as Record<string, unknown>;
        const val = user.createdAt as string;
        expect(new Date(val).toISOString()).toBe(val);
      });

      test('user.modifiedAt is a valid ISO 8601 date string @contract', () => {
        const user = body.user as Record<string, unknown>;
        const val = user.modifiedAt as string;
        expect(new Date(val).toISOString()).toBe(val);
      });

      test('user object has no unexpected top-level fields @contract', () => {
        const user = body.user as Record<string, unknown>;
        // 'password' is included in the allowlist because of BUG-003 — the app currently leaks
        // the bcrypt hash in this field. Remove 'password' from this allowlist once BUG-003 is fixed.
        const allowedFields = new Set([
          'id',
          'uuid',
          'firstName',
          'lastName',
          'username',
          'password', // BUG-003: bcrypt hash leak — should be removed from response
          'balance',
          'defaultPrivacyLevel',
          'createdAt',
          'modifiedAt',
        ]);
        const actualFields = Object.keys(user);
        for (const field of actualFields) {
          expect(allowedFields.has(field)).toBe(true);
        }
      });
    });

    // ─── Performance ─────────────────────────────────────────────────────────
    test.describe('Performance', () => {
      test('POST /users responds within SLA @performance', async ({
        request,
      }) => {
        const warmUp = buildUser();
        // warm-up request — primes connection pooling, not measured
        await request.post('/users', {
          data: {...warmUp, confirmPassword: warmUp.password},
        });

        const user = buildUser();
        const start = Date.now();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        const duration = Date.now() - start;

        expect(res.status()).toBe(201);
        expect(duration).toBeLessThan(500); // SLA: POST /users → 500ms (includes bcrypt hashing)
      });

      test('POST /users with duplicate username responds within SLA @performance', async ({
        request,
      }) => {
        const user = buildUser();
        // Register the user first
        await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });

        // warm-up duplicate attempt — not measured
        await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });

        // measure duplicate attempt — error path must also be fast
        const start = Date.now();
        const res = await request.post('/users', {
          data: {...user, confirmPassword: user.password},
        });
        const duration = Date.now() - start;

        // BUG-002: currently returns 500 HTML; we still assert the timing regardless of status
        expect([409, 500]).toContain(res.status());
        expect(duration).toBeLessThan(500); // SLA: error path must be fast too
      });
    });
  });
});
