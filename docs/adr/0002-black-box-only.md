# ADR-0002 — Black-box only (REGLA #1)

**Status:** Accepted · 2026-06-14

## Context

The app under test lives in a separate repository. We could read its source to
write "better" tests, but that couples the suite to internal implementation and
defeats the purpose of an independent QA platform.

## Decision

**Never read or access the app's source code.** All knowledge of the UI and API
comes from:

- the live browser (Playwright MCP: snapshot, evaluate, network),
- direct `curl` / `request` calls,
- our own documentation (`docs/workflows/app-workflow-map.md`, briefs).

Consequences for tooling:

- App **security** is tested with **DAST** (OWASP ZAP) — black-box, attacks the
  running app. **SAST** (Semgrep/SonarQube) on the app is forbidden; it would
  need source. SAST/secret scanning is scoped to _our_ repo only.
- DB integrity uses the DB as an independent source of truth, not the app's ORM
  code.

## Consequences

- Tests survive app refactors as long as behavior is stable.
- Forces tests to assert observable behavior, not implementation.
- Security coverage is shaped by what black-box tooling can see (accepted — DAST
  is the right model for an external target).
- Every agent definition restates REGLA #1 to keep generation honest.
