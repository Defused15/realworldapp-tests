# Security Testing

Layered, **black-box** security testing. Nothing here reads the app source
(REGLA #1): DAST attacks the running app from the outside; SCA/secret scanning
target our own test repo and the app's published Docker image.

## Layers

| Layer                  | Tool                | Target                  | Script                     |
| ---------------------- | ------------------- | ----------------------- | -------------------------- |
| **DAST** (dynamic)     | OWASP ZAP baseline  | running app (UI + API)  | `npm run security:zap`     |
| **SCA** (dependencies) | Trivy + `npm audit` | this repo + app image   | `npm run security:deps`    |
| **Secrets**            | Gitleaks            | this repo's git history | `npm run security:secrets` |

> In-test security assertions (XSS, SQLi, IDOR, auth) already live in the
> Playwright/vitest suites under the `@security` tag — `npm run test:security`.
> ZAP complements them with full passive/active scanning of every response.

## Prerequisites

- App running + seeded (for ZAP): `docker compose up -d && npm run db:seed`
- Docker (ZAP and Trivy run as containers) — or install the CLIs directly.

> **Local ZAP on macOS:** if the app runs as a host process bound to
> `127.0.0.1` (not in Docker), the ZAP container can't reach it on Docker
> Desktop (`Connection refused`). ZAP runs correctly in CI (Linux) where the app
> is reachable. Locally, point it at a container-reachable URL via
> `BASE_URL=http://host.docker.internal:3000` only if the app binds `0.0.0.0`.
> `npm run security:deps` (Trivy) and `npm run security:secrets` (Gitleaks) have
> no such limitation — they scan this repo directly.

## Run

```bash
# DAST — baseline scan of the UI; rules in security/zap/rules.tsv gate the result
npm run security:zap

# SCA — vulns + misconfig + secrets in this repo
npm run security:deps

# Secret scan of git history
npm run security:secrets
```

## Config

```
security/
  zap/rules.tsv        ← which ZAP alerts FAIL / WARN / IGNORE the build
  trivy/trivy.yaml     ← severities, scanners, exit-code gate
.gitleaks.toml         ← secret rules + allowlist for intentional test creds
```

## Reports & triage

Findings are triaged into `docs/security-reports/`, one file per scan with the
finding, severity, whether it's an app bug or accepted risk, and the action.
Mirrors how `docs/bug-reports/` works for functional bugs.

## Note on SAST

Static analysis of the **app** (Semgrep/SonarQube) would require its source and
violates REGLA #1. SAST is therefore scoped to our own test repo only; the app's
security is covered by DAST (ZAP) — the correct tool for a black-box target.
