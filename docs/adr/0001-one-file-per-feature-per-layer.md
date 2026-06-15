# ADR-0001 — One file per feature, per layer

**Status:** Accepted · 2026-06-14

## Context

A test suite can be organized by test _type_ (all smoke tests together), by
_page_, or by _feature_. As the suite grows across layers (UI, API, DB,
performance), an inconsistent scheme makes tests hard to find and `--grep`
unpredictable.

## Decision

Organize by **feature within each layer**:

- The **layer** (test type/tool) is the **folder**: `tests/ui/`, `tests/api/`,
  `tests/db-integration/`, `perf/k6/scenarios/`.
- The **feature** is the **file**: `signin`, `home`, `transaction`.
- The **category** (happy/edge/security/a11y/visual/contract/perf) is a
  `describe` block **inside** the file: feature → component/endpoint → category.

Performance has a second axis ("how hard"): this is a runtime `PROFILE` env var
(`smoke|load|stress|spike`), **not** separate files — so it stays one file per
feature like every other layer.

## Consequences

- `--grep "Remember Me"` returns every test for that component across categories.
- Obvious home for any new test; no bikeshedding on placement.
- A feature's behavior is reviewable in one file per layer.
- Trade-off: large files. Accepted — mitigated by the strict internal nesting.
