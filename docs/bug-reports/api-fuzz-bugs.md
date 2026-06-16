# API Fuzz Bug Reports (Schemathesis)

Property/fuzz testing with **Schemathesis** (`npm run test:schemathesis`, driven by
`docs/api/openapi.yaml`) surfaced **9 unique server errors (HTTP 500)** across 8 distinct
defects. Every one shares the same root cause class: **the backend performs no input or
existence validation before handing data to Prisma** — missing rows, dangling foreign
keys, wrong types, and malformed bodies all surface as unhandled `500`s that leak the
backend filesystem path, Prisma internals, and source snippets (see BUG-API-FUZZ-008).

All findings are **app defects** (we do not patch the app — black-box suite). They are
tracked as GitHub issues via the `bug-report-sync` workflow; see `docs/bug-reports/bugs.yml`.

Seed for reproduction: run `npm run test:schemathesis` with the app on `localhost:3001`.

---

## BUG-API-FUZZ-001 — POST /users accepts wrong-typed fields → 500 (no input validation)

**Severity**: High
**Area**: API / `POST /users`
**Tag**: `@security` `@contract`

**Steps to reproduce**:

1. `POST /users` with a type-violating body, e.g. `avatar` as a boolean:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"avatar": false, "balance": 0, "defaultPrivacyLevel": "public", "email": "", "firstName": "0", "lastName": "0", "password": "0", "phoneNumber": "", "username": "0"}' \
  http://localhost:3001/users
```

**Expected**: `422 Validation error` (typed/validated request body)
**Actual**: `500 Internal Server Error` — `PrismaClientValidationError: Invalid prisma.user.create() invocation` (the bad value reaches Prisma unvalidated). Related to the known missing-field crash documented for signin (`POST /users` with missing required fields → 500 HTML).

**Test impact**: covered by Schemathesis (`not_a_server_error` check). Contract test should assert `422` once fixed.

---

## BUG-API-FUZZ-002 — POST /transactions with non-existent receiverId → 500 (FK violation)

**Severity**: High
**Area**: API / `POST /transactions`
**Tag**: `@regression` `@contract`

**Steps to reproduce**:

```bash
curl -X POST -H 'Content-Type: application/json' \
  -d '{"amount": 1, "description": "0", "privacyLevel": "public", "receiverId": "0", "source": "", "transactionType": "payment"}' \
  http://localhost:3001/transactions
```

**Expected**: `422` / `404` — receiver does not exist
**Actual**: `500` — `PrismaClientKnownRequestError: Foreign key constraint violated on the constraint: transaction_...`. The app does not verify `receiverId` references a real user before insert.

---

## BUG-API-FUZZ-003 — POST /notifications/bulk with non-array `items` → 500 (not iterable)

**Severity**: Medium
**Area**: API / `POST /notifications/bulk`
**Tag**: `@regression` `@contract`

**Steps to reproduce**:

```bash
curl -X POST -H 'Content-Type: application/json' -d '{"items": {}}' \
  http://localhost:3001/notifications/bulk
```

**Expected**: `422` — `items` must be an array
**Actual**: `500` — `TypeError: notifications is not iterable` (`createNotifications`). The handler iterates `items` without checking it is an array.

---

## BUG-API-FUZZ-004 — GET /transactions/public with unknown query param → 500

**Severity**: Medium
**Area**: API / `GET /transactions/public`
**Tag**: `@regression`

**Steps to reproduce**:

```bash
curl -X GET 'http://localhost:3001/transactions/public?page=1&foo=42' \
  -H 'Cookie: connect.sid=...'
```

**Expected**: `200` (unknown params ignored) or `422`
**Actual**: `500` — `PrismaClientValidationError: Invalid prisma.transaction.findMany()` with `senderId: { in: [] }`. An unrecognized query param collapses the filter-building logic and produces an invalid Prisma query.

---

## BUG-API-FUZZ-005 — GET /contacts/{username} for unknown username → 500

**Severity**: Medium
**Area**: API / `GET /contacts/{username}`
**Tag**: `@regression`

**Steps to reproduce**:

```bash
curl -X GET 'http://localhost:3001/contacts/no-such-user' -H 'Cookie: connect.sid=...'
```

**Expected**: `404` / `200` with empty list
**Actual**: `500` — `TypeError: Cannot read properties of null (reading 'id')` in `getContactsByUsername`. The user lookup returns `null` and the code dereferences `.id` without a guard.

---

## BUG-API-FUZZ-006 — PATCH /users/{userId} to a taken username → 500 (should be 409)

**Severity**: Medium
**Area**: API / `PATCH /users/{userId}`
**Tag**: `@regression` `@contract`

**Steps to reproduce**:

1. `PATCH /users/{ownId}` setting `username` to one already used by another user.

**Expected**: `409 Conflict` (username already taken)
**Actual**: `500` — `PrismaClientKnownRequestError: Unique constraint failed on the fields: (username)`. The unique-constraint collision is not caught and mapped to a `409`.

---

## BUG-API-FUZZ-007 — Write ops on a non-existent transactionId → 500 (null dereference)

**Severity**: High
**Area**: API / `PATCH /transactions/{id}`, `POST /likes/{id}`, `POST /comments/{id}`
**Tag**: `@regression`

**Steps to reproduce** (any of):

```bash
curl -X PATCH -d '{"requestStatus":"pending"}' -H 'Content-Type: application/json' \
  http://localhost:3001/transactions/0H0PmLWSLK8m6L5qq   # non-existent id
curl -X POST http://localhost:3001/likes/72wWk3
curl -X POST -d '{"content":"x","transactionId":"0H0..."}' -H 'Content-Type: application/json' \
  http://localhost:3001/comments/0H0...
```

**Expected**: `404 Not Found`
**Actual**: `500` — `TypeError: Cannot destructure property 'senderId' of ... as it is null` in `updateTransactionById` / `createLikes` / `createComments`. All three load the transaction, get `null`, and destructure it without an existence check. One defect, three entry points.

---

## BUG-API-FUZZ-008 — 500 responses leak backend filesystem path, Prisma internals & source

**Severity**: High (Security — information disclosure)
**Area**: API / global error handler
**Tag**: `@security`

**Steps to reproduce**: trigger any of the 500s above.

**Expected**: a generic `500` body with no internal details (stack traces logged server-side only).
**Actual**: the HTML error page exposes absolute backend paths (`/Users/.../cypress-app/backend/database.ts:103`), Prisma query internals, source-line snippets, and `node_modules` paths. This hands an attacker the server's directory layout, ORM, and code structure.

**Recommendation**: the app needs a production error handler that returns `{ error: 'Internal Server Error' }` and logs detail server-side. (We cannot fix the app; tracked for visibility.)
