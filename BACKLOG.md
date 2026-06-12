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
