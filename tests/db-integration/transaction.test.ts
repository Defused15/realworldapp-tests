/**
 * Transaction — DB Integration Tests
 *
 * Covers write-then-SQL-read for transaction creation, likes, and comments.
 * Also verifies referential integrity (no orphaned rows) and schema constraints.
 *
 * Known schema bug:
 *   BUG-TXN-SCHEMA-001: transactions.amount is double precision, not integer (cents).
 *   All amount comparisons use Number() on both sides to avoid float precision mismatch.
 */
import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import {
  pool,
  queryOne,
  queryCount,
  queryMany,
  queryScalar,
} from '../helpers/db-helpers';
import {loginAs, createFreshUser, type ApiClient} from './helpers';

const SEED_TX_ID = 'Ec6hHyL6SC2F';
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

// ─── Transaction GET API vs DB ────────────────────────────────────────────────

describe('Transaction Data Integrity', () => {
  describe('Transaction GET API vs DB', () => {
    it('GET /transactions/{id}: core fields match DB row', async () => {
      const res = await client.get(`/transactions/${SEED_TX_ID}`);
      expect(res.ok).toBeTruthy();
      const {transaction: apiTx} = await res.json();

      const row = await queryOne<{
        id: string;
        senderId: string;
        receiverId: string;
        description: string;
        privacyLevel: string;
        status: string;
      }>(
        'SELECT id, "senderId", "receiverId", description, "privacyLevel", status FROM transactions WHERE id = $1',
        [SEED_TX_ID],
      );

      expect(row).not.toBeNull();
      expect(apiTx.id).toBe(row!.id);
      expect(apiTx.senderId).toBe(row!.senderId);
      expect(apiTx.receiverId).toBe(row!.receiverId);
      expect(apiTx.description).toBe(row!.description);
      expect(apiTx.privacyLevel).toBe(row!.privacyLevel);
      expect(apiTx.status).toBe(row!.status);
    });

    it('GET /transactions/{id}: amount matches DB (both as Number — BUG-TXN-SCHEMA-001)', async () => {
      const res = await client.get(`/transactions/${SEED_TX_ID}`);
      const {transaction: apiTx} = await res.json();

      const row = await queryOne<{amount: string}>(
        'SELECT amount FROM transactions WHERE id = $1',
        [SEED_TX_ID],
      );
      expect(row).not.toBeNull();
      expect(Number(apiTx.amount)).toBe(Number(row!.amount));
    });

    it('GET /transactions/{id}: like count in API matches DB', async () => {
      const res = await client.get(`/transactions/${SEED_TX_ID}`);
      const {transaction: apiTx} = await res.json();
      const apiLikeCount = (apiTx.likes as unknown[]).length;

      const dbLikeCount = await queryCount('likes', '"transactionId" = $1', [
        SEED_TX_ID,
      ]);
      expect(apiLikeCount).toBe(dbLikeCount);
    });

    it('GET /transactions/{id}: comment count in API matches DB', async () => {
      const res = await client.get(`/transactions/${SEED_TX_ID}`);
      const {transaction: apiTx} = await res.json();
      const apiCommentCount = (apiTx.comments as unknown[]).length;

      const dbCommentCount = await queryCount(
        'comments',
        '"transactionId" = $1',
        [SEED_TX_ID],
      );
      expect(apiCommentCount).toBe(dbCommentCount);
    });
  });

  // ─── Like writes ─────────────────────────────────────────────────────────────

  describe('Like writes', () => {
    it('POST /likes/{txId}: row inserted in DB with correct userId and transactionId', async () => {
      const {userId, client: freshClient} = await createFreshUser();

      const countBefore = await queryCount('likes', '"transactionId" = $1', [
        SEED_TX_ID,
      ]);

      const res = await freshClient.post(`/likes/${SEED_TX_ID}`, {});
      expect(res.ok).toBeTruthy();

      const countAfter = await queryCount('likes', '"transactionId" = $1', [
        SEED_TX_ID,
      ]);
      expect(countAfter).toBe(countBefore + 1);

      const row = await queryOne<{userId: string; transactionId: string}>(
        'SELECT "userId", "transactionId" FROM likes WHERE "userId" = $1 AND "transactionId" = $2',
        [userId, SEED_TX_ID],
      );
      expect(row).not.toBeNull();
      expect(row!.userId).toBe(userId);
      expect(row!.transactionId).toBe(SEED_TX_ID);
    });

    it('POST /likes/{txId}: GET /transactions/{id} like count matches DB after like', async () => {
      const {client: freshClient} = await createFreshUser();
      await freshClient.post(`/likes/${SEED_TX_ID}`, {});

      const res = await client.get(`/transactions/${SEED_TX_ID}`);
      const {transaction: apiTx} = await res.json();
      const apiLikeCount = (apiTx.likes as unknown[]).length;

      const dbLikeCount = await queryCount('likes', '"transactionId" = $1', [
        SEED_TX_ID,
      ]);
      expect(apiLikeCount).toBe(dbLikeCount);
    });
  });

  // ─── Comment writes ───────────────────────────────────────────────────────────

  describe('Comment writes', () => {
    it('POST /comments/{txId}: row inserted in DB', async () => {
      const {userId, client: freshClient} = await createFreshUser();
      const content = `di-test-${Date.now()}`;

      const res = await freshClient.post(`/comments/${SEED_TX_ID}`, {content});
      expect(res.ok).toBeTruthy();

      const row = await queryOne<{
        content: string;
        userId: string;
        transactionId: string;
      }>(
        'SELECT content, "userId", "transactionId" FROM comments WHERE "userId" = $1 AND "transactionId" = $2',
        [userId, SEED_TX_ID],
      );
      expect(row).not.toBeNull();
      expect(row!.content).toBe(content);
      expect(row!.userId).toBe(userId);
      expect(row!.transactionId).toBe(SEED_TX_ID);
    });

    it('POST /comments/{txId}: content stored verbatim in DB', async () => {
      const {client: freshClient} = await createFreshUser();
      const content = `verbatim-${Date.now()}-🎯`;

      await freshClient.post(`/comments/${SEED_TX_ID}`, {content});

      const row = await queryOne<{content: string}>(
        'SELECT content FROM comments WHERE content = $1 AND "transactionId" = $2',
        [content, SEED_TX_ID],
      );
      expect(row).not.toBeNull();
      expect(row!.content).toBe(content);
    });

    it('POST /comments/{txId}: comment count in API matches DB after comment', async () => {
      const {client: freshClient} = await createFreshUser();
      await freshClient.post(`/comments/${SEED_TX_ID}`, {
        content: `count-check-${Date.now()}`,
      });

      const res = await client.get(`/transactions/${SEED_TX_ID}`);
      const {transaction: apiTx} = await res.json();
      const apiCommentCount = (apiTx.comments as unknown[]).length;

      const dbCommentCount = await queryCount(
        'comments',
        '"transactionId" = $1',
        [SEED_TX_ID],
      );
      expect(apiCommentCount).toBe(dbCommentCount);
    });
  });

  // ─── Referential integrity ────────────────────────────────────────────────────

  describe('Referential Integrity', () => {
    it('no orphaned likes — every like.transactionId points to an existing transaction', async () => {
      const orphans = await queryMany(`
        SELECT l.id
        FROM likes l
        LEFT JOIN transactions t ON t.id = l."transactionId"
        WHERE t.id IS NULL
      `);
      expect(orphans.length).toBe(0);
    });

    it('no orphaned comments — every comment.transactionId points to an existing transaction', async () => {
      const orphans = await queryMany(`
        SELECT c.id
        FROM comments c
        LEFT JOIN transactions t ON t.id = c."transactionId"
        WHERE t.id IS NULL
      `);
      expect(orphans.length).toBe(0);
    });

    it('no orphaned notifications — every notification.transactionId points to an existing transaction', async () => {
      const orphans = await queryMany(`
        SELECT n.id
        FROM notifications n
        LEFT JOIN transactions t ON t.id = n."transactionId"
        WHERE t.id IS NULL
      `);
      expect(orphans.length).toBe(0);
    });

    it('all transactions.senderId reference existing users', async () => {
      const orphans = await queryMany(`
        SELECT tx.id
        FROM transactions tx
        LEFT JOIN users u ON u.id = tx."senderId"
        WHERE u.id IS NULL
      `);
      expect(orphans.length).toBe(0);
    });

    it('all transactions.receiverId reference existing users', async () => {
      const orphans = await queryMany(`
        SELECT tx.id
        FROM transactions tx
        LEFT JOIN users u ON u.id = tx."receiverId"
        WHERE u.id IS NULL
      `);
      expect(orphans.length).toBe(0);
    });
  });

  // ─── Schema validation ────────────────────────────────────────────────────────

  describe('Schema Validation', () => {
    it('BUG-TXN-SCHEMA-001 (fixed): transactions.amount is stored as integer cents', async () => {
      const dataType = await queryScalar(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'amount'
      `);
      // Fixed: money is now integer cents, not double precision.
      expect(dataType).toBe('integer');
    });

    it('likes.transactionId has FK constraint', async () => {
      const count = await queryScalar(`
        SELECT COUNT(*)
        FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = rc.constraint_name
        WHERE kcu.table_name = 'likes'
          AND kcu.column_name = 'transactionId'
      `);
      expect(Number(count)).toBeGreaterThan(0);
    });

    it('comments.transactionId has FK constraint', async () => {
      const count = await queryScalar(`
        SELECT COUNT(*)
        FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = rc.constraint_name
        WHERE kcu.table_name = 'comments'
          AND kcu.column_name = 'transactionId'
      `);
      expect(Number(count)).toBeGreaterThan(0);
    });

    void SEED_USER_ID;
  });
});
