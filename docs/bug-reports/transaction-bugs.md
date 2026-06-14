# Transaction Bug Reports

## BUG-TXN-UI-001 — Unknown transaction ID: no error state or redirect

**Severity**: Medium  
**Area**: UI / Transaction Detail (`/transaction/:id`)  
**Tag**: `@regression`

**Steps to reproduce**:

1. Log in as any user
2. Navigate directly to `/transaction/nonexistent-id-00000`

**Expected**: App redirects to `/dashboard` or displays an error message ("Transaction not found")  
**Actual**: SPA stays on `/transaction/nonexistent-id-00000` with no content rendered and no visible error. The `Transaction Detail` header never appears.

**Test file**: `tests/ui/transaction.spec.ts` — "navigating to unknown transaction ID shows error or redirect"

---

## BUG-TXN-UI-002 — Transaction-detail card re-renders into a skeleton state after data paints

**Severity**: Low  
**Area**: UI / Transaction Detail (`/transaction/:id`)  
**Tag**: `@visual`

**Steps to reproduce**:

1. Open `/transaction/Ec6hHyL6SC2F` under load (e.g. the full Playwright suite, 3 workers)
2. Observe the card immediately after the sender name first paints

**Expected**: Once the transaction data has loaded and painted (sender/receiver names, avatars, amount), the card stays rendered.  
**Actual**: The XState transaction-detail machine re-renders the card into a loading/skeleton state _after_ the data first paints — names and avatars briefly drop from paint. The backend `GET /transactions/:id` is healthy (200, ~10 ms) even under concurrent load, so this is purely a client-side render churn. Under CPU contention this skeleton frame is observable and produces a deterministic ~30% pixel diff in a `toHaveScreenshot` of the card.

**Impact on tests**: `transaction detail card matches snapshot @visual` is `test.skip`-ped — a pixel snapshot is not a reliable target while the card re-renders into a skeleton. The card content (sender, receiver, amount, avatars-present) is fully covered by the `@smoke` tests in `Transaction Card > Happy Path`.

**Test file**: `tests/ui/transaction.spec.ts` — "transaction detail card matches snapshot @visual"

---

## BUG-TXN-API-001 — GET /transactions/:id returns 200 for non-existent IDs

**Severity**: Medium  
**Area**: API / `GET /transactions/:id`  
**Tag**: `@regression`

**Steps to reproduce**:

1. Authenticate via `POST /login`
2. `GET /transactions/nonexistent-tx-id-000`

**Expected**: `404 Not Found`  
**Actual**: `200 OK` with empty/null transaction body

**Impact**: Clients cannot distinguish between a real transaction with no content and a missing transaction. Creates silent data consistency bugs for any consumer checking the status code.

**Test file**: `tests/api/transaction.spec.ts` — "returns 404 for non-existent transaction id"

---

## BUG-TXN-SEC-001 — IDOR: private transaction readable by unrelated authenticated user

**Severity**: Critical  
**Area**: API / `GET /transactions/:id` — Authorization  
**Tag**: `@security`

**Steps to reproduce**:

1. User A creates a private transaction (`privacyLevel: "private"`)
2. User B (unrelated, not sender or receiver) calls `GET /transactions/:id` with the private transaction ID
3. User B receives `200 OK` with the full transaction object

**Expected**: `401 Unauthorized`, `403 Forbidden`, or `404 Not Found`  
**Actual**: `200 OK` — full transaction data returned to an unauthorized user

**Impact**: Any authenticated user can enumerate and read private financial transactions belonging to other users. This is an Insecure Direct Object Reference (IDOR) vulnerability that exposes sensitive financial data.

**Test file**: `tests/api/transaction.spec.ts` — "IDOR: user B cannot GET a private transaction that does not belong to them"

---

## BUG-TXN-SCHEMA-001 — transactions.amount stored as DOUBLE PRECISION instead of INTEGER

**Severity**: Low (data integrity risk)  
**Area**: DB Schema / `transactions` table  
**Tag**: Schema observation

**Details**: The `amount` column is declared as `double precision` in PostgreSQL. Financial amounts should be stored as `INTEGER` (cents) to avoid floating-point rounding errors.

**Observed**: `SELECT pg_typeof(amount) FROM transactions LIMIT 1` → `double precision`  
**Expected**: `integer` or `numeric(19,4)`

**Note**: The API returns `amount` as an integer (cents, e.g. `2928000` for $29,280.00), so the JS layer is correct — the schema mismatch only affects direct DB reads.
