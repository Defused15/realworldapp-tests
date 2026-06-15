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
 → setup-app (docker compose up + db:seed)        [STUB — pendiente: imagen GHCR]
   → GATE 1: contract   (@contract, schema)
     → GATE 2: api       (@smoke + @regression + @security)
       → GATE 3: db      (vitest data-integrity)
         → GATE 4: ui    (@smoke; +@a11y/@visual en nightly)
           → GATE 5: performance  (k6, thresholds = gate)
             → GATE 6: security   (ZAP + Trivy + Gitleaks)
               → report  (Allure → GitHub Pages)
```

- Cada gate es un `job` con `needs: [gate-anterior]`. Si contract rompe, no se gasta lo demás.
- App levantada **una vez** en `setup-app` y reusada por los gates.
- PR = gates 1-4 rápidos; push a main = todos; nightly = todo + visual/a11y/perf pesado.
- `continue-on-error` solo en gates informativos (`@visual`, `@a11y`).

## Dependencia pendiente (lo del docker — diferido)

`setup-app` necesita la app en CI. Decisión: **imagen Docker publicada en GHCR**
(black-box, respeta REGLA #1). Hasta que exista, `setup-app` es un stub documentado
y los gates corren contra `vars.API_URL`. Ver `BACKLOG.md` sección "Roadmap de arquitectura".

Datos que faltan para activarlo:

- Nombre de imagen GHCR de la app (`vars.APP_IMAGE`)
- Env vars que la app espera para conectar a Postgres

## Triggers por workflow

| Workflow       | Trigger       | Gates                                               |
| -------------- | ------------- | --------------------------------------------------- |
| `pipeline.yml` | PR, push main | gates secuenciales (PR = 1-4, push = todos)         |
| `nightly.yml`  | cron          | full incl. visual/a11y/perf stress/spike + ZAP full |

ARGUMENTS: $ARGUMENTS
