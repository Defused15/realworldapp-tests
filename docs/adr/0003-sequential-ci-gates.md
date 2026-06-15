# ADR-0003 — Sequential CI gates

**Status:** Accepted · 2026-06-14

## Context

The previous CI was six independent workflows running in parallel, none of which
started the app, several with `continue-on-error: true` (so they never actually
blocked). There was no ordering and no real gating.

## Decision

A single orchestrator (`.github/workflows/pipeline.yml`) chains jobs with
`needs:` in cheapest-to-most-expensive order, failing fast:

```
quality ──┬─ security-sca (no app)
          └─ contract → api → db → ui → performance → zap → report
```

- App-dependent gates are guarded by `vars.APP_IMAGE`. The way the app is booted
  in CI (publish a Docker image to GHCR) is **deferred**; until configured, the
  app gates are skipped and `quality` + `security-sca` keep CI green. The single
  place to wire the app is `.github/actions/setup-app/action.yml`.
- PR runs the fast gates (1–4 at reduced scope); push to main runs all; heavy
  suites (`@visual`, `@a11y`, perf stress/spike, cross-browser) run in
  `nightly.yml`.

## Consequences

- A broken contract stops the pipeline before wasting minutes on UI/perf.
- Clean gate graph in the Actions UI.
- Booting the app per app-dependent job (hermetic) is duplicated work; accepted
  for isolation over a shared long-lived environment.
- Superseded the six standalone workflows (removed).
