# QA Report Skill

Invoca `qa-lead-agent` para generar un **reporte ejecutivo / de cliente** del estado de QA de la app: cobertura, KPIs de calidad, riesgo y defectos, y el **caso de negocio** (por qué automatizar, traducido a dinero/ROI).

## Uso

```
/qa-report               ← genera el reporte completo con métricas en vivo
/qa-report --quick       ← usa los últimos reportes existentes (no re-corre las suites)
/qa-report --no-money    ← omite la sección de ROI/negocio (solo métricas técnicas)
```

## Qué produce

Un documento pulido: `docs/qa-reports/qa-status-<YYYY-MM-DD>.md`, escrito para un **decisor no técnico** (cliente, product owner, manager). Incluye:

1. **Executive summary** — salud general + la línea de dinero, en 3-5 frases.
2. **Scorecard** — tabla semáforo (cobertura, pass rate, mutation, coverage, perf, security, defectos, flakiness).
3. **Cobertura** — por feature × capa (UI/API/DB/perf/security) y qué protege cada una.
4. **KPIs de calidad** — cada métrica con su "¿y esto qué significa?".
5. **Riesgo y defectos** — los bugs que el suite encontró, severidad, impacto de negocio.
6. **El caso de negocio** — la parte de dinero (ver abajo).
7. **Recomendaciones** — priorizadas por costo/valor.

## El caso de negocio (lo importante)

El agente SIEMPRE traduce el esfuerzo de testing a dinero y riesgo:

- **Regla 1×10×100**: un defecto cuesta ~1× en dev, ~10× en QA, ~100× en producción. Cada bug atrapado antes de release es ese multiplicador evitado.
- **ROI de automatización**: `checks_automatizados × min_manuales_c/u × releases/año × tarifa_QA` = horas/dinero ahorrados. Con break-even explícito.
- **Feedback más rápido = entregas más rápidas** (marco DORA).
- **Cobertura como seguro**: % de flujos críticos con red de seguridad.
- **Por qué automatizar las MÉTRICAS** (no solo los tests): estado de calidad siempre vigente, auditable y con tendencia — sin hojas de cálculo manuales.

## Métricas que agrega (de NUESTRO repo — black-box)

- Conteo de tests por capa y por tag (`@smoke`, `@security`, etc.)
- Pass rate en vivo (corre las suites que puedan correr)
- **Mutation score** (calidad de los tests) · **Coverage %** (utils)
- **Performance** (SLOs k6) · **Security** (Trivy/Gitleaks/ZAP, `docs/security-reports/`)
- **Defectos conocidos** (`docs/bug-reports/` + `test.skip` con `BUG-...`)
- **Flakiness** (tests reintentados)

## Tendencia

Si ya existen reportes previos en `docs/qa-reports/`, agrega una línea de tendencia (ej. "coverage 82% → 85%, defectos 7 → 5").

## Honestidad (regla del QA Lead)

- Un test skippeado es **riesgo rastreado**, no cobertura. Nunca lo cuenta como cubierto.
- Sin precisión falsa: rangos + supuestos explícitos, no ROI inventado al centavo.
- Si performance/security no se corrió, lo dice y qué haría falta.

## Prerequisitos

- Para métricas en vivo: app corriendo + `npm run db:seed`. Con `--quick` no hace falta.

ARGUMENTS: $ARGUMENTS
