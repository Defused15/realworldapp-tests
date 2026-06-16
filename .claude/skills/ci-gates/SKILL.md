# CI Gates Skill

Explica y regenera el pipeline de gates secuenciales (`.github/workflows/pipeline.yml`).

## Uso

```
/ci-gates              ← muestra el orden de gates y su estado
/ci-gates regenerate   ← reescribe pipeline.yml desde la definición de gates
```

## El pipeline (orden de gates, fail-fast barato→caro)

```
quality (lint + tsc + build)
 → setup-app (levanta imagen GHCR + Postgres desechable + db:seed)
   → GATE 1: contract   (@contract, schema + Schemathesis fuzz)
     → GATE 2: api       (@smoke + @regression + @security)
       → GATE 3: db      (vitest data-integrity)
         → GATE 4: ui    (@smoke, sharded ×2; +@a11y/@visual en nightly)
           → GATE 5: performance  (k6, thresholds = gate)
             → GATE 6: security   (ZAP + Trivy + Gitleaks)
               → report  (Allure → GitHub Pages)
```

- Cada gate es un `job` con `needs: [gate-anterior]`. Si contract rompe, no se gasta lo demás.
- App levantada **una vez** en `setup-app` y reusada por los gates.
- PR = gates 1-4 rápidos; push a main = todos; nightly = todo + visual/a11y/perf pesado + chaos.
- `continue-on-error` solo en gates informativos (`@visual`, `@a11y`).

## App en CI — ✅ RESUELTO (2026-06-16)

`setup-app` ya **no es un stub**. La app entra a CI con el patrón **producer/consumer
GHCR** (black-box, respeta REGLA #1): el repo del app publica una imagen opaca
`ghcr.io/defused15/rwa-app` y `setup-app` (`.github/actions/setup-app/app.ci.yml`)
la levanta junto a un Postgres desechable (`rwa_test`, host 5433) por run, auto-seedeado.
Los gates dependientes del app se activan con `vars.APP_IMAGE` ya configurado.
Detalle en `BACKLOG.md` §0 y `docs/adr/0003-sequential-ci-gates.md`.

## Triggers por workflow

| Workflow              | Trigger          | Gates                                                       |
| --------------------- | ---------------- | ----------------------------------------------------------- |
| `pipeline.yml`        | PR, push main    | gates secuenciales (PR = 1-4, push = todos)                 |
| `nightly.yml`         | cron             | full incl. visual/a11y/perf stress/spike + ZAP full + chaos |
| `staging-smoke.yml`   | cron 6h + manual | `@staging` synthetic smoke read-only vs Railway             |
| `release.yml`         | workflow_run     | semantic-release tras pipeline verde en main                |
| `bug-report-sync.yml` | push a bugs.yml  | renderiza/cierra issues desde `docs/bug-reports/bugs.yml`   |

ARGUMENTS: $ARGUMENTS
