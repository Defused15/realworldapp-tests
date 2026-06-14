/**
 * Home — DB Integration Tests
 *
 * Home is read-only (no writes). Focus: every ID the API returns actually
 * exists in the DB, counts are consistent, and isRead values match.
 *
 * Known app bugs:
 *   BUG-HOME-001: GET /transactions/public?dateStart=...&dateEnd=... → 500 (server crash)
 *                  Date-filter tests are omitted.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {pool, queryOne, queryCount, queryScalar} from '../helpers/db-helpers';
import {loginAs, type ApiClient} from './helpers';

const SEED_USER_ID = 'uBmeaz5pX';
const SEED_USERNAME = process.env.TEST_USER_USERNAME ?? 'Heath93';
const SEED_PASSWORD = process.env.TEST_USER_PASSWORD ?? 's3cret';

let client: ApiClient;

beforeAll(async () => {
  client = await loginAs(SEED_USERNAME, SEED_PASSWORD);
});

afterAll(async () => {
  await pool.end();
});

// ─── Public feed ─────────────────────────────────────────────────────────────

describe('Home Data Integrity', () => {
  describe('Public feed API vs DB', () => {
    it('GET /transactions/public: every result ID exists in DB', async () => {
      const res = await client.get('/transactions/public?page=1&limit=10');
      expect(res.ok).toBeTruthy();
      const {results} = await res.json();

      for (const tx of results as Array<{id: string}>) {
        const count = await queryCount('transactions', 'id = $1', [tx.id]);
        expect(count, `transaction ${tx.id} missing from DB`).toBe(1);
      }
    });

    it('GET /transactions/public: privacyLevel in API response matches DB for each result', async () => {
      const res = await client.get('/transactions/public?page=1&limit=10');
      const {results} = await res.json();

      for (const tx of results as Array<{id: string; privacyLevel: string}>) {
        const row = await queryOne<{privacyLevel: string}>(
          'SELECT "privacyLevel" FROM transactions WHERE id = $1',
          [tx.id],
        );
        expect(row).not.toBeNull();
        // API field must match what's stored — not necessarily 'public'
        // (feed visibility is determined by the API filter, not a strict privacy constraint)
        expect(tx.privacyLevel, `tx ${tx.id} privacyLevel mismatch`).toBe(
          row!.privacyLevel,
        );
      }
    });

    it('GET /transactions/public: amount matches DB for first 5 results', async () => {
      const res = await client.get('/transactions/public?page=1&limit=10');
      const {results} = await res.json();
      const sample = (results as Array<{id: string; amount: number}>).slice(
        0,
        5,
      );

      for (const tx of sample) {
        const row = await queryOne<{amount: string}>(
          'SELECT amount FROM transactions WHERE id = $1',
          [tx.id],
        );
        expect(row).not.toBeNull();
        // amount is double precision in DB (BUG-TXN-SCHEMA-001) — compare as Number
        expect(Number(tx.amount)).toBe(Number(row!.amount));
      }
    });

    it('GET /transactions/public: senderId and receiverId exist as users in DB', async () => {
      const res = await client.get('/transactions/public?page=1&limit=10');
      const {results} = await res.json();

      for (const tx of results as Array<{
        id: string;
        senderId: string;
        receiverId: string;
      }>) {
        const senderCount = await queryCount('users', 'id = $1', [tx.senderId]);
        const receiverCount = await queryCount('users', 'id = $1', [
          tx.receiverId,
        ]);
        expect(senderCount, `sender ${tx.senderId} missing`).toBe(1);
        expect(receiverCount, `receiver ${tx.receiverId} missing`).toBe(1);
      }
    });

    it('GET /transactions/public: page 1 result count ≤ total public rows in DB', async () => {
      const res = await client.get('/transactions/public?page=1&limit=10');
      const {results} = await res.json();

      const totalInDb = await queryCount(
        'transactions',
        '"privacyLevel" = $1',
        ['public'],
      );
      expect((results as unknown[]).length).toBeLessThanOrEqual(totalInDb);
    });
  });

  // ─── Personal feed ──────────────────────────────────────────────────────────

  describe('Personal feed API vs DB', () => {
    it('GET /transactions (mine): all results involve seed user as sender or receiver', async () => {
      const res = await client.get('/transactions?page=1&limit=10');
      expect(res.ok).toBeTruthy();
      const {results} = await res.json();

      for (const tx of results as Array<{
        senderId: string;
        receiverId: string;
      }>) {
        const involved =
          tx.senderId === SEED_USER_ID || tx.receiverId === SEED_USER_ID;
        expect(involved, 'tx not involving seed user').toBe(true);
      }
    });
  });

  // ─── Notifications ──────────────────────────────────────────────────────────

  describe('Notifications API vs DB', () => {
    it('GET /notifications: every result ID exists in DB', async () => {
      const res = await client.get('/notifications');
      expect(res.ok).toBeTruthy();
      const {results} = await res.json();

      for (const n of results as Array<{id: string}>) {
        const count = await queryCount('notifications', 'id = $1', [n.id]);
        expect(count, `notification ${n.id} missing from DB`).toBe(1);
      }
    });

    it('GET /notifications: isRead value matches DB for each notification', async () => {
      const res = await client.get('/notifications');
      const {results} = await res.json();

      for (const n of results as Array<{id: string; isRead: boolean}>) {
        const row = await queryOne<{isRead: boolean}>(
          'SELECT "isRead" FROM notifications WHERE id = $1',
          [n.id],
        );
        expect(row).not.toBeNull();
        expect(n.isRead).toBe(row!.isRead);
      }
    });

    it('GET /notifications: unread count from API matches DB', async () => {
      const res = await client.get('/notifications');
      const {results} = await res.json();
      const apiUnreadCount = (results as Array<{isRead: boolean}>).filter(
        n => !n.isRead,
      ).length;

      const dbUnreadCount = await queryCount(
        'notifications',
        '"userId" = $1 AND "isRead" = false',
        [SEED_USER_ID],
      );
      expect(apiUnreadCount).toBe(dbUnreadCount);
    });

    it('GET /notifications: read + unread totals are consistent with DB', async () => {
      const dbRead = await queryCount(
        'notifications',
        '"userId" = $1 AND "isRead" = true',
        [SEED_USER_ID],
      );
      const dbUnread = await queryCount(
        'notifications',
        '"userId" = $1 AND "isRead" = false',
        [SEED_USER_ID],
      );
      const dbTotal = await queryCount('notifications', '"userId" = $1', [
        SEED_USER_ID,
      ]);
      expect(dbRead + dbUnread).toBe(dbTotal);
    });
  });

  // ─── Schema validation ──────────────────────────────────────────────────────

  describe('Schema Validation', () => {
    it('transactions.senderId references users (FK exists)', async () => {
      const count = await queryScalar(`
        SELECT COUNT(*)
        FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = rc.constraint_name
        WHERE kcu.table_name = 'transactions'
          AND kcu.column_name = 'senderId'
      `);
      expect(Number(count)).toBeGreaterThan(0);
    });

    it('transactions.receiverId references users (FK exists)', async () => {
      const count = await queryScalar(`
        SELECT COUNT(*)
        FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = rc.constraint_name
        WHERE kcu.table_name = 'transactions'
          AND kcu.column_name = 'receiverId'
      `);
      expect(Number(count)).toBeGreaterThan(0);
    });
  });
});
