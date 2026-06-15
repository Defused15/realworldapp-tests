# ADR-0004 — SQL data-integrity layer

**Status:** Accepted · 2026-06-14

## Context

API tests are circular: if the app has a bug in _both_ write and read paths, a
`POST` → `GET` round-trip still passes. Float serialization, ORM truncation,
missing DB constraints, and orphaned foreign keys all hide behind a green
API suite.

## Decision

Add a dedicated **data-integrity layer** (`tests/db-integration/`, Vitest) that
cross-checks API responses against **direct SQL reads** of the live PostgreSQL —
an independent source of truth, not API-vs-API.

Patterns: write-then-SQL-read, GET-then-SQL-confirm, orphan checks (LEFT JOIN),
API-list-vs-DB-count, and schema validation (constraints/columns exist).

## Consequences

- Catches bugs invisible to API round-trips (e.g. `amount` stored as
  `double precision` instead of integer — documented as BUG-TXN-SCHEMA-001).
- Requires DB access (`pg` over `DB_*` env, or `docker exec psql`), so these
  tests need the DB reachable — wired in the `db` CI gate.
- Kept in Vitest (not Playwright) to separate the SQL suite from browser/API
  e2e and run it sequentially against seeded state.
