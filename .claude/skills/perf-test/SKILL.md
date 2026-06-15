# Performance Testing Skill

Invoca `perf-agent` para escribir/actualizar el escenario k6 de una feature, o corre los escenarios existentes.

## Uso

```
/perf-test home              ← escribe/actualiza perf/k6/scenarios/home.js
/perf-test transaction       ← escribe/actualiza perf/k6/scenarios/transaction.js
/perf-test run home load     ← corre PROFILE=load contra home.js
/perf-test                   ← lista escenarios existentes y SLOs
```

## Principio de organización

**Un archivo por feature** (`perf/k6/scenarios/<feature>.js`), igual que UI/API/DB.
La forma de carga NO son archivos: es el env `PROFILE` (`smoke|load|stress|spike`).

```
perf/k6/
  lib/{config,thresholds,profiles,journey}.js   ← compartido
  scenarios/<feature>.js                         ← uno por feature
```

## Qué hace el agente

1. Lee `docs/workflows/app-workflow-map.md` + brief → endpoints de la feature
2. Reusa `lib/journey.js` (o agrega el journey de la feature ahí)
3. Escribe `scenarios/<feature>.js` con `...profile()` + `thresholds` (los SLOs SON el gate)
4. Verifica: `PROFILE=smoke k6 run perf/k6/scenarios/<feature>.js`

## Correr

```bash
npm run perf:smoke     # PROFILE=smoke  → home.js
npm run perf:load      # PROFILE=load   → home.js
npm run perf:stress    # nightly
npm run perf:spike     # nightly

# cualquier feature × profile:
PROFILE=load k6 run perf/k6/scenarios/<feature>.js
```

## Observabilidad (Grafana)

```bash
docker compose -f observability/docker-compose.observability.yml up -d
npm run perf:load:grafana       # k6 → Prometheus → Grafana
open http://localhost:3030
```

## Prerequisitos

- k6 instalado (`brew install k6`)
- App corriendo + `npm run db:seed`

ARGUMENTS: $ARGUMENTS
