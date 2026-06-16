/**
 * Signup / User — DB Integration Tests
 *
 * Cross-checks POST /users API responses against live PostgreSQL rows.
 * Pattern: API write → parameterized SQL read → field-by-field comparison.
 *
 * Known app bugs documented here (not fixed — just asserted as-is):
 *   BUG-001: POST /users with missing fields → 500 HTML, not 422
 *   BUG-002: POST /users with duplicate username → 500 HTML, not 409
 *   BUG-003: POST /users response leaks bcrypt hash in user.password
 */
import {describe, it, expect, afterAll} from 'vitest';
import {pool, queryOne, queryCount, queryScalar} from '../helpers/db-helpers';
import {createFreshUser, loginAs} from './helpers';

const SEED_USER_ID = 'uBmeaz5pX';
const SEED_USERNAME = process.env.TEST_USER_USERNAME ?? 'Heath93';
const SEED_PASSWORD = process.env.TEST_USER_PASSWORD ?? 's3cret';

afterAll(async () => {
  await pool.end();
});

// ─── User writes ─────────────────────────────────────────────────────────────

describe('Signup / User Data Integrity', () => {
  describe('User writes', () => {
    it('POST /users: all sent fields persist in DB', async () => {
      const {username, userId} = await createFreshUser();

      const row = await queryOne<{
        id: string;
        firstName: string;
        lastName: string;
        username: string;
      }>(
        'SELECT id, "firstName", "lastName", username FROM users WHERE id = $1',
        [userId],
      );

      expect(row).not.toBeNull();
      expect(row!.id).toBe(userId);
      expect(row!.username).toBe(username);
      expect(row!.firstName).toBe('Test');
      expect(row!.lastName).toBe('User');
    });

    it('POST /users: password stored as bcrypt hash (never plaintext)', async () => {
      const {password, userId} = await createFreshUser();

      const row = await queryOne<{password: string}>(
        'SELECT password FROM users WHERE id = $1',
        [userId],
      );

      expect(row).not.toBeNull();
      expect(row!.password).toMatch(/^\$2[ab]\$/);
      expect(row!.password).not.toBe(password);
    });

    it('POST /users: API response id matches DB row id', async () => {
      const {userId} = await createFreshUser();

      const count = await queryCount('users', 'id = $1', [userId]);
      expect(count).toBe(1);
    });

    it('POST /users: createdAt is written as a valid timestamp', async () => {
      const {userId} = await createFreshUser();

      const row = await queryOne<{createdAt: Date}>(
        'SELECT "createdAt" FROM users WHERE id = $1',
        [userId],
      );

      expect(row).not.toBeNull();
      const ts = new Date(row!.createdAt).getTime();
      expect(ts).toBeGreaterThan(0);
      expect(Date.now() - ts).toBeLessThan(60_000);
    });

    it('BUG-004 (fixed): POST /users does NOT leak the bcrypt hash, but the DB stores it', async () => {
      const {password} = await createFreshUser();
      const newUsername = `bug004_${Date.now()}`;

      const res = await fetch(
        `${process.env.API_URL ?? 'http://localhost:3001'}/users`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            firstName: 'Doc',
            lastName: 'Bug',
            username: newUsername,
            password,
          }),
        },
      );
      const {user} = await res.json();

      // Fixed: the API must not expose the password hash in the response.
      expect(user.password).toBeUndefined();

      // Data-integrity: the hash IS persisted (bcrypt) in the DB.
      const row = await queryOne<{password: string}>(
        'SELECT password FROM users WHERE username = $1',
        [newUsername],
      );
      expect(row!.password).toMatch(/^\$2[ab]\$/);
    });
  });

  // ─── API vs DB consistency ──────────────────────────────────────────────────

  describe('API vs DB Consistency', () => {
    it('POST /login: authenticated user id exists in DB', async () => {
      const client = await loginAs(SEED_USERNAME, SEED_PASSWORD);
      const res = await client.get('/users/uBmeaz5pX');
      expect(res.ok).toBeTruthy();
      const {user} = await res.json();

      const count = await queryCount('users', 'id = $1', [user.id]);
      expect(count).toBe(1);
    });

    it('GET /users/{id}: firstName, lastName, username match DB', async () => {
      const client = await loginAs(SEED_USERNAME, SEED_PASSWORD);
      const res = await client.get(`/users/${SEED_USER_ID}`);
      const {user: apiUser} = await res.json();

      const row = await queryOne<{
        firstName: string;
        lastName: string;
        username: string;
        balance: string;
      }>(
        'SELECT "firstName", "lastName", username, balance FROM users WHERE id = $1',
        [SEED_USER_ID],
      );

      expect(row).not.toBeNull();
      expect(apiUser.firstName).toBe(row!.firstName);
      expect(apiUser.lastName).toBe(row!.lastName);
      expect(apiUser.username).toBe(row!.username);
      // balance is float8 in DB — compare as Number on both sides
      expect(Number(apiUser.balance)).toBe(Number(row!.balance));
    });
  });

  // ─── Schema validation ──────────────────────────────────────────────────────

  describe('Schema Validation', () => {
    it('users.username has a unique index in DB (Prisma @unique)', async () => {
      // Prisma implements @unique as a unique index, not a formal SQL constraint
      const count = await queryScalar(`
        SELECT COUNT(*)
        FROM pg_indexes
        WHERE tablename = 'users'
          AND indexdef ILIKE '%unique%'
          AND indexdef ILIKE '%username%'
      `);
      expect(Number(count)).toBeGreaterThan(0);
    });

    it('users table has all required columns', async () => {
      const required = [
        'id',
        'firstName',
        'lastName',
        'username',
        'password',
        'email',
        'balance',
        'createdAt',
        'modifiedAt',
      ];

      for (const col of required) {
        const count = await queryScalar(`
          SELECT COUNT(*)
          FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = '${col}'
        `);
        expect(Number(count), `missing column: users.${col}`).toBe(1);
      }
    });
  });
});
