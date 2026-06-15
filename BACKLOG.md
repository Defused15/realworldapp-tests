# Backlog

## Reportes a plataforma externa

Integrar los resultados de tests con una plataforma de reporting centralizada para tener histórico, tendencias y alertas.

**Opciones a evaluar:**

- **Allure Report** — open source, self-hosted, historial visual de runs
- **Playwright Cloud (Microsoft)** — nativo con Playwright, trazas en la nube
- **QA Hub propio** — patrón usado en qaplayground: un repo centralizado que agrega JSON reports de múltiples proyectos vía GitHub Actions y los publica en GitHub Pages

**Referencia de implementación:**
Ver `.github/actions/playwright-report-hub/action.yml` en el proyecto `qaplayground` — implementa el patrón de QA Hub con `repository_dispatch`.

**Variables de entorno necesarias:**

- `HUB_TOKEN` — GitHub PAT con permisos de escritura al repo del hub
- `HUB_REPO` — repo destino (ej. `Defused15/test-hub`)

---

# Roadmap de arquitectura (review 2026-06-14)

Notas de la revisión de arquitectura para llevar el repo a "portfolio-grade completo".
Todo lo de abajo está **pendiente** — capturado para retomar después.

## 0. ✅ RESUELTO (2026-06-15) — app en CI vía producer/consumer GHCR

**Hecho.** El bloqueador #1 (meter la app a CI) está implementado con el patrón
enterprise **producer/consumer**, black-box (REGLA #1 intacta: CI consume imagen
opaca, nunca el source):

- **Producer** — repo del app (`Defused15/cypress-realworld-app`):
  - Dockerfile: nuevo target **`ci`** (source horneado; corre como 2 servidores
    web:3000 + api:3001, a diferencia de `prod` que colapsa todo a 3001).
  - `.github/workflows/build-push.yml`: en cada push a `develop` buildea el target
    `ci` y publica `ghcr.io/defused15/rwa-app:latest` + `:sha` con `GITHUB_TOKEN`
    (sin PAT manual, nunca se vence). Package **público** → pull sin auth.
- **Consumer** — este repo:
  - `.github/actions/setup-app/app.ci.yml`: compose CI (postgres + api + web,
    DB `rwa_test`, postgres publicado en host 5433 para el gate de db-integrity).
  - `setup-app/action.yml`: stub eliminado → levanta `app.ci.yml`.
  - `pipeline.yml`: quitados los `services: postgres` por job (el compose es dueño
    de la DB); gate db → `rwa_test`/`5433`. Gates gated en `vars.APP_IMAGE`.
  - `vars.APP_IMAGE` = `ghcr.io/defused15/rwa-app:latest` → gates activos.

> Aprendizaje clave: la app son **2 servidores** (vite:3000 + API:3001); el target
> `prod` no sirve para los tests (un solo origen 3001) y el target `dev` no trae
> source. Por eso se creó el target `ci`. Detalle abajo conservado como histórico.

---

## 0-bis. (Histórico) Decisión original: arrancar por CI gates + levantar app

Cuando se retome, el punto de partida elegido es **el pipeline de gates secuenciales**
(desbloquea todo lo demás — sin app corriendo en CI nada más funciona).

**Cómo entra la app a CI — decisión recomendada: Opción 1 (imagen Docker en GHCR).**

- Black-box puro (respeta REGLA #1): CI hace `docker pull` + `run` de un artefacto opaco;
  ni yo ni el runner ven el source de la app.
- Rápido (~20-40s pull vs 3-5 min de rebuild por run) y versionable por tag.
- Patrón producer/consumer real: el repo de la app publica su imagen; este repo la consume.

**Qué falta para destrabar (lo hace el usuario, en el REPO DE LA APP — yo no lo toco):**

1. Publicar la imagen a GHCR. Mínimo manual (~5 min, una vez):
   ```bash
   echo $GHCR_PAT | docker login ghcr.io -u defused15 --password-stdin
   docker compose build
   docker tag <imagen-local> ghcr.io/defused15/rwa-app:latest
   docker push ghcr.io/defused15/rwa-app:latest
   # marcar el package como público en GitHub → CI hace pull sin auth
   ```
   (el nombre exacto de la imagen sale de `docker compose images`)
2. (Profesional, opcional) automatizar con un `build-push.yml` en el repo de la app
   usando `docker/build-push-action@v6` + `secrets.GITHUB_TOKEN` (sin PAT, nunca se queda vieja).

**Qué escribo yo (de NUESTRO lado, sin tocar el repo de la app):**

- `app.ci.yml` — compose chiquito que referencia la imagen publicada **+ servicio postgres**.
  Necesito 2 datos del usuario: **(a)** nombre de la imagen GHCR, **(b)** env vars que la app
  espera para conectar a Postgres (host/port/db/user/pass).
- `pipeline.yml` — orquestador con gates (ver abajo), `setup-app` parametrizado contra
  `vars.APP_IMAGE` para que funcione apenas exista la imagen.

**Alternativas descartadas como base** (sí útiles para un gate extra):

- Opción 2 (checkout + build del repo app en CI): autocontenido pero acopla a source y
  rebuild lento cada run.
- Opción 3 (staging desplegado): ideal para un gate "smoke contra prod-like", pero NO como
  base — resetear la DB de un entorno vivo es peligroso. `.env.staging` hoy es placeholder.

## 1. Mejora barata de alto impacto: agentes deben leer el workflow map

**Hallazgo:** de los 9 agentes, solo `exploratory-agent` lee/escribe
`docs/workflows/app-workflow-map.md` (50KB con rutas, data-test attrs, workflows y llamadas
API por página). Los otros 8 (`ui-test-agent`, `api-test-agent`, `pom-agent`,
`gherkin-agent`, debug agents) **no lo consumen** — re-descubren cada página desde cero.

**Acción:** `gen-test` Fase 1 debe `Read docs/workflows/app-workflow-map.md` e inyectarlo al
context brief; los agentes de test/POM/gherkin lo citan como fuente primaria.

## 2. Diagnóstico del CI actual (gaps)

Los 6 workflows actuales (`api-tests`, `ui-tests`, `contract-tests`, `security-tests`,
`performance-tests`, `a11y-tests`) son **pipelines independientes y paralelos**, no gates:

1. **Ninguno levanta la app** — todos asumen `vars.API_URL` externo → en Actions fallarían
   porque no hay app corriendo. (Bloqueador #1, resuelto por sección 0.)
2. No hay orquestador con `needs:` → no existe el orden contract→api→db→perf→security.
3. `continue-on-error: true` en los gates → hoy **no bloquean** de verdad.

## 3. Pipeline de gates propuesto (el ask principal)

Un orquestador único `pipeline.yml` con jobs encadenados por `needs:`, fail-fast barato→caro:

```
quality (lint + tsc + build)               ~1 min
 → setup-app (docker compose up + db:seed) servicio compartido, levantar UNA vez
   → GATE 1: contract   @contract          (schema, rapidísimo)
     → GATE 2: api       @smoke+@regression+@security
       → GATE 3: db      vitest (integrity)
         → GATE 4: ui    @smoke (+ @a11y, @visual en nightly)
           → GATE 5: performance  k6 (thresholds = gate)
             → GATE 6: security   ZAP + Trivy
               → report  Allure publish a GitHub Pages
```

- PR = gates 1-4 rápidos; push a main = todos; nightly = todo + visual/a11y/perf pesado.
- Quitar `continue-on-error` salvo en `@visual`/`@a11y` informativos.
- App levantada una vez en `setup-app` y reusada — no por gate.

## 4. Tooling nuevo (portfolio-grade)

| Herramienta                           | Tipo             | Dónde / nota                                                                                                              |
| ------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **k6**                                | Load/perf        | `perf/k6/` — escenarios smoke/load/stress/spike. Sus `thresholds` SON el gate (p95<500ms → falla el job).                 |
| **Grafana + Prometheus/InfluxDB**     | Observabilidad   | `observability/docker-compose.observability.yml` — k6 → Prometheus remote-write → dashboards Grafana. Capturas al README. |
| **OWASP ZAP**                         | DAST (black-box) | `security/zap/` — baseline scan contra la app corriendo. Respeta REGLA #1 (no lee source). Fit natural.                   |
| **Trivy**                             | SCA/contenedor   | Escanea imagen Docker de la app + deps.                                                                                   |
| **Gitleaks + OSV-Scanner/Dependabot** | Secrets + SCA    | Sobre NUESTRO repo de tests.                                                                                              |
| **Stryker**                           | Mutation testing | Prueba la _calidad_ de los tests, no solo que pasen. Muy fuerte en portafolio QA.                                         |
| **Allure**                            | Reporting        | Ya en backlog (arriba). Historial/tendencias en GitHub Pages.                                                             |
| **Lighthouse CI**                     | Perf web/UI      | Budgets de performance del front (complementa k6 que es API).                                                             |

**Nota black-box:** SAST tipo Semgrep sobre la APP violaría REGLA #1 (necesita source). Por eso
DAST (ZAP) es lo correcto para seguridad de la app; SAST/secrets quedan solo para nuestro repo.

## 5. Mejoras a agentes / skills

- `exploratory-agent` como **dependencia formal** de `gen-test` (inyectar el workflow map).
- Nuevos: `perf-agent` (escribe escenarios k6 desde el workflow map + endpoints),
  `security-agent` (config ZAP + triage de findings → `docs/security-reports/`), skill
  `/ci-gates` que regenere el orquestador.
- `feedback-agent` podría también alimentar thresholds de k6 y reglas de ZAP, no solo CLAUDE.md.

## 6. Estructura top-level propuesta

```
tests/            ← (igual) api, ui, db-integration, ...
perf/k6/          ← escenarios + thresholds + lib
security/zap/     ← reglas + baseline config
observability/    ← docker-compose + grafana/dashboards
.github/workflows/
  pipeline.yml          ← orquestador con gates
  _reusable-*.yml       ← jobs workflow_call
  app.ci.yml            ← compose CI (app GHCR + postgres)
docs/
  security-reports/     ← nuevo
  perf-reports/         ← nuevo
```

## 7. ✅ Datos resueltos (2026-06-15)

- Imagen GHCR: `ghcr.io/defused15/rwa-app:latest` (target `ci`, pública).
- Postgres: `postgres/postgres@postgres:5432/rwa_test` (interno); host 5433 para db-integrity.
- App publicada automáticamente por `build-push.yml` en el repo del app (no hace falta push manual).

---

# Estado de implementación (2026-06-14)

## ✅ Implementado en esta iteración

- **Agentes leen el workflow map** (gen-test Fase 0 + pom/ui/api/gherkin/perf).
- **Performance (k6)**: `perf/k6/` — un archivo por feature, load shape vía `PROFILE`. SLOs = gate.
- **Observabilidad**: `observability/` — Prometheus + Grafana con dashboard k6 auto-provisionado.
- **Security**: `security/` — ZAP (DAST), Trivy (SCA), Gitleaks (secrets) + `docs/security-reports/`.
- **Mutation testing** (Stryker) sobre `tests/utils` + unit tests en `tests/unit/`.
- **Lighthouse CI** (`lighthouserc.js`) y **Allure** (reporter en playwright.config).
- **Nuevos agentes**: `perf-agent`, `security-agent`. **Nuevos skills**: `/perf-test`, `/security-scan`, `/ci-gates`.
- **CI gated**: `pipeline.yml` (contract→api→db→ui→perf→zap→report) + `nightly.yml`. Reemplazó los 6 workflows sueltos. `setup-app` como composite stub (espera imagen GHCR).
- **Gobernanza**: CODEOWNERS, PR/issue templates, Dependabot.
- **Cross-browser**: proyectos `ui-firefox` / `ui-webkit` (nightly, reusan storageState).
- **Documentación**: `docs/test-strategy.md` + `docs/adr/` (4 ADRs).

> ~~Pendiente único para activar los gates con app: la parte docker/GHCR~~ →
> **✅ HECHO (2026-06-15)**, ver sección 0 arriba. Gates activos vía producer/consumer GHCR.

## 📋 Gaps enterprise restantes (priorizados)

| Gap                                                                                                                                                                                                              | Impacto | Costo                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------ |
| ~~**Flaky-test detection / quarantine** + retry analytics~~ — ✅ HECHO: `@quarantine` tag excluido de gates + job non-gating, `flaky:summary` parsea el JSON report → CI step summary (retries=2 ya configurado) | Alto    | Medio                          |
| **Contract/property testing black-box (Schemathesis desde OpenAPI)** — Pact descartado: requiere ownership del consumer + provider states en el repo del app, viola black-box (REGLA #1)                         | Medio   | Medio                          |
| **Ephemeral environments por PR** (preview deploys)                                                                                                                                                              | Alto    | Alto (atado a docker diferido) |
| ~~**CI sharding** (matrix `--shard`)~~ — ✅ HECHO: UI gate corre `shard 1/2` + `2/2` en `pipeline.yml`                                                                                                           | Medio   | Bajo                           |
| **OpenTelemetry / test observability** (trazas de tests)                                                                                                                                                         | Medio   | Alto                           |
| **SonarQube / coverage gates**                                                                                                                                                                                   | Medio   | Medio                          |
| **semantic-release + conventional commits + CHANGELOG**                                                                                                                                                          | Medio   | Bajo                           |
| **Notificaciones** (Slack/PagerDuty on failure)                                                                                                                                                                  | Bajo    | Bajo                           |
| **Chaos/resilience testing**                                                                                                                                                                                     | Bajo    | Alto                           |
| **devcontainer / Dockerized test runner**                                                                                                                                                                        | Medio   | Medio                          |

---

# 🏁 Presentación — HACER AL FINAL DEL PROYECTO

Cuando todo lo demás esté cerrado, pulir el **README como vitrina de portafolio**
(lo más valioso para un reclutador no es más tooling, es la presentación):

- **Intro fuerte**: qué es, por qué, y el "wow" en las primeras 5 líneas.
- **Capturas / GIFs**: dashboard de Grafana (k6), reporte Allure, el scorecard del
  reporte QA ejecutivo (`docs/qa-reports/`), el grafo de gates de CI.
- **Badges**: CI status, cobertura, último run.
- **Diagrama** de la arquitectura (pirámide de capas + flujo de gates).
- **Sección "highlights"**: DB-integrity, mutation testing, QA Lead report, ROI.
- Enlazar `docs/test-strategy.md` y `docs/adr/` para quien quiera el detalle.
- Asegurar que se pueda **explicar cada pieza en una entrevista** (el README es el guion).

> Razón de dejarlo al final: el README debe reflejar el estado FINAL real (no se
> re-escribe cada vez que cambia algo). Hacerlo de último = una sola pasada buena.
