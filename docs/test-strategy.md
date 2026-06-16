# Test Strategy

How this suite is organized, why, and how it runs. One page to understand the
whole project.

## 1. Principle: one file per feature, per layer

Everything follows the same rule:

> **The layer (test type) is the folder. The feature is the file. The category
> is a `describe` block inside.**

A "feature" ≈ a page or a group of related endpoints (`signin`, `signup`,
`home`, `transaction`). This makes `--grep "Remember Me"` return every test for
that component across categories, and makes it obvious where any test lives.

| Layer                                              | Folder                  | One file per                  | Runner                 |
| -------------------------------------------------- | ----------------------- | ----------------------------- | ---------------------- |
| Unit (pure code)                                   | `tests/unit/`           | module                        | Vitest                 |
| UI functional                                      | `tests/ui/`             | feature                       | Playwright             |
| API functional / contract / security / perf-assert | `tests/api/`            | feature                       | Playwright             |
| DB integrity                                       | `tests/db-integration/` | feature                       | Vitest + SQL           |
| Performance (load)                                 | `perf/k6/scenarios/`    | feature                       | k6                     |
| Security (DAST/SCA/secrets)                        | `security/`             | tool config (scans whole app) | ZAP / Trivy / Gitleaks |

Inside a UI/API spec, the nesting is **feature → component/endpoint → category**:

```
Signin                         (feature — one describe)
  Form Submission              (component)
    Happy Path   @smoke
    Edge Cases   @regression
    Security     @security
    Accessibility @a11y
    Visual       @visual
  Remember Me                  (component)
    ...
```

## 2. The test pyramid here

```
        ╱╲   Performance (k6)        ← load shape via PROFILE env
       ╱  ╲  Security (ZAP/Trivy)    ← black-box DAST + SCA
      ╱ E2E╲  UI (Playwright)        ← @smoke @regression @security @a11y @visual
     ╱──────╲ API + Contract         ← per endpoint
    ╱  DB     ╲ Data integrity (SQL)  ← API vs real Postgres rows
   ╱  Unit     ╲ Factories            ← pure, fast, mutation-tested
  ╱─────────────╲
```

Two ideas that raise the bar above a typical e2e repo:

- **DB-integrity layer** breaks the circularity of API-only tests (a write+read
  bug passes an API round-trip; SQL catches it). See ADR-0004.
- **Mutation testing** (Stryker) on the pure factories proves the unit tests
  actually catch regressions, not just pass.

## 3. Tags (what runs when)

| Tag            | Purpose                                                     | CI trigger                        |
| -------------- | ----------------------------------------------------------- | --------------------------------- |
| `@smoke`       | Happy path                                                  | every PR + push                   |
| `@regression`  | Edge + negative                                             | push + nightly                    |
| `@security`    | Auth, IDOR, injection                                       | push + weekly                     |
| `@contract`    | API schema                                                  | every PR + nightly                |
| `@a11y`        | WCAG 2.1 AA                                                 | nightly + PRs touching ui/        |
| `@visual`      | Screenshot diff                                             | nightly only (Chromium baselines) |
| `@performance` | Response-time SLAs (in-suite)                               | nightly                           |
| `@resilience`  | Fault injection (API 500/slow/abort) via route interception | push + nightly                    |
| `@staging`     | Read-only synthetic smoke vs live Railway deployment        | cron every 6 h + manual           |
| `@quarantine`  | Known-flaky, isolated (non-gating)                          | push (non-gating job)             |

> Beyond the in-suite tags above, the platform also runs **out-of-process**
> quality gates: **Schemathesis** property/fuzz (regression gate, driven by
> `docs/api/openapi.yaml`), **k6** load (SLO gate), **Stryker** mutation, and
> **chaos** experiments (`chaos/`, non-gating nightly).

## 4. CI gates (fail-fast, cheap → expensive)

`.github/workflows/pipeline.yml` chains jobs with `needs:`:

```
quality ──┬─ security-sca (no app)
          └─ setup-app → contract → api → db → ui (sharded ×2) → performance → zap → report
```

- The app is booted in CI via a **producer/consumer GHCR image**
  (`ghcr.io/defused15/rwa-app`, black-box) — see ADR-0003. App-dependent gates
  are guarded by `vars.APP_IMAGE`; the UI gate runs as two parallel shards.
- `nightly.yml` runs the heavy suites: full UI incl. `@visual`/`@a11y`,
  cross-browser, perf stress/spike, and the **chaos** experiments.
- `staging-smoke.yml` runs the read-only `@staging` synthetic smoke every 6 h.
- `release.yml` runs semantic-release after a green pipeline on main
  (auto version + CHANGELOG + GitHub Release from Conventional Commits).

## 5. Tooling map

| Concern             | Tool                 | Where                                                    |
| ------------------- | -------------------- | -------------------------------------------------------- |
| UI/API e2e          | Playwright           | `tests/`, `playwright.config.ts`                         |
| Unit + DB integrity | Vitest               | `tests/unit`, `tests/db-integration`                     |
| Mutation            | Stryker              | `stryker.config.mjs`                                     |
| Property / fuzz     | Schemathesis         | `tests/scripts/schemathesis.sh`, `docs/api/openapi.yaml` |
| Load/perf           | k6                   | `perf/k6/`                                               |
| Observability       | Prometheus + Grafana | `observability/`                                         |
| Chaos / resilience  | Pumba + Docker       | `chaos/`                                                 |
| DAST                | OWASP ZAP            | `security/zap/`                                          |
| SCA / secrets       | Trivy, Gitleaks      | `security/`, `.gitleaks.toml`                            |
| Release             | semantic-release     | `release.yml`, `.releaserc.json`                         |
| Front-end budgets   | Lighthouse CI        | `lighthouserc.js`                                        |
| Reporting           | Allure               | `allure-results/` → `report:allure`                      |
| Accessibility       | axe-core             | in `@a11y` tests                                         |

## 6. Non-negotiables

- **Black-box only (REGLA #1).** No test or tool reads the app's source. DAST,
  not SAST, for app security. See ADR-0002.
- **Atomic & isolated.** No explicit timeouts — auto-waits only. Read-only tests
  share `storageState`; mutating tests create their own user/data.
- **Skip only for app bugs.** A skipped test must point to a `BUG-…` entry in the
  manifest `docs/bug-reports/bugs.yml` (rendered to a GitHub issue), never a
  test-side workaround. Never assert broken behavior to keep a test green.

## 7. AI test platform

The suite is generated and maintained by purpose-built agents/skills (see
`CLAUDE.md` → "AI agents"). All generation agents read
`docs/workflows/app-workflow-map.md` as the primary context source.
