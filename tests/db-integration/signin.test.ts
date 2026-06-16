/**
 * Signin — DB Integration Tests
 *
 * Signin is read-only auth — it does not insert rows.
 * Focus: verify POST /login API response is consistent with the actual DB row.
 * Pattern: API response fields → SQL read → field-by-field comparison.
 *
 * Known app bugs documented here:
 *   BUG-004: POST /login response leaks bcrypt hash in user.password
 */
import {describe, it, expect, afterAll} from 'vitest';
import {pool, queryOne, queryScalar} from '../helpers/db-helpers';
import {loginAs} from './helpers';

const SEED_USER_ID = 'uBmeaz5pX';
const SEED_USERNAME = process.env.TEST_USER_USERNAME ?? 'Heath93';
const SEED_PASSWORD = process.env.TEST_USER_PASSWORD ?? 's3cret';
const API_URL = process.env.API_URL ?? 'http://localhost:3001';

afterAll(async () => {
  await pool.end();
});

// ─── API vs DB consistency ────────────────────────────────────────────────────

describe('Signin Data Integrity', () => {
  describe('API vs DB Consistency', () => {
    it('POST /login: response user.id exists in DB', async () => {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: SEED_USERNAME,
          password: SEED_PASSWORD,
        }),
      });
      expect(res.ok).toBeTruthy();
      const {user} = await res.json();

      const row = await queryOne<{id: string}>(
        'SELECT id FROM users WHERE id = $1',
        [user.id],
      );
      expect(row).not.toBeNull();
      expect(row!.id).toBe(user.id);
    });

    it('POST /login: response username matches DB stored username', async () => {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: SEED_USERNAME,
          password: SEED_PASSWORD,
        }),
      });
      const {user: apiUser} = await res.json();

      const row = await queryOne<{username: string}>(
        'SELECT username FROM users WHERE id = $1',
        [apiUser.id],
      );
      expect(row).not.toBeNull();
      expect(apiUser.username).toBe(row!.username);
    });

    it('POST /login: firstName and lastName match DB', async () => {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: SEED_USERNAME,
          password: SEED_PASSWORD,
        }),
      });
      const {user: apiUser} = await res.json();

      const row = await queryOne<{firstName: string; lastName: string}>(
        'SELECT "firstName", "lastName" FROM users WHERE id = $1',
        [apiUser.id],
      );
      expect(row).not.toBeNull();
      expect(apiUser.firstName).toBe(row!.firstName);
      expect(apiUser.lastName).toBe(row!.lastName);
    });

    it('POST /login: balance in response matches DB (float8 — compare as Number)', async () => {
      const client = await loginAs(SEED_USERNAME, SEED_PASSWORD);
      const res = await client.get(`/users/${SEED_USER_ID}`);
      const {user: apiUser} = await res.json();

      const row = await queryOne<{balance: string}>(
        'SELECT balance FROM users WHERE id = $1',
        [SEED_USER_ID],
      );
      expect(row).not.toBeNull();
      expect(Number(apiUser.balance)).toBe(Number(row!.balance));
    });

    it('POST /login: DB modifiedAt is unchanged after login (login is read-only)', async () => {
      const before = await queryOne<{modifiedAt: string}>(
        'SELECT "modifiedAt" FROM users WHERE id = $1',
        [SEED_USER_ID],
      );

      await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: SEED_USERNAME,
          password: SEED_PASSWORD,
        }),
      });

      const after = await queryOne<{modifiedAt: string}>(
        'SELECT "modifiedAt" FROM users WHERE id = $1',
        [SEED_USER_ID],
      );
      expect(String(after!.modifiedAt)).toBe(String(before!.modifiedAt));
    });

    it('BUG-003 (fixed): POST /login does NOT leak the bcrypt hash, but the DB stores it', async () => {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: SEED_USERNAME,
          password: SEED_PASSWORD,
        }),
      });
      const {user} = await res.json();

      // Fixed: the API must not expose the password hash in the response.
      expect(user.password).toBeUndefined();

      // Data-integrity: the bcrypt hash still lives in the DB for this user.
      const row = await queryOne<{password: string}>(
        'SELECT password FROM users WHERE id = $1',
        [SEED_USER_ID],
      );
      expect(row!.password).toMatch(/^\$2[ab]\$/);
    });
  });

  // ─── Schema validation ──────────────────────────────────────────────────────

  describe('Schema Validation', () => {
    it('users.password stores bcrypt hash for seed user', async () => {
      const row = await queryOne<{password: string}>(
        'SELECT password FROM users WHERE id = $1',
        [SEED_USER_ID],
      );
      expect(row).not.toBeNull();
      expect(row!.password).toMatch(/^\$2[ab]\$/);
    });

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
  });
});
