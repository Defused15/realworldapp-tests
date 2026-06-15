# Performance Testing (k6)

Load and performance tests for the RWA API, written in [k6](https://k6.io). These
are **black-box** — they hit the live API exactly like the Playwright/vitest
suites and never touch the app source (REGLA #1).

## Organization — one file per feature, load shape via env var

Same principle as the rest of the suite: **one file per feature per layer.**
Performance has two axes, kept orthogonal:

- **What feature** → the file: `scenarios/<feature>.js` (home, transaction, …)
- **How hard** → the `PROFILE` env var: `smoke | load | stress | spike`

So you do NOT get a file per load shape. `PROFILE=stress k6 run scenarios/home.js`.

```
perf/k6/
  lib/
    config.js        ← base URLs + seed user from env vars
    thresholds.js    ← SLOs (these ARE the CI gate)
    profiles.js      ← load shapes: smoke / load / stress / spike (the "how hard" axis)
    journey.js       ← reusable per-feature journeys (login, readJourney, …)
  scenarios/
    home.js          ← one file per feature (home browse journey)
    transaction.js   ← (added by perf-agent per feature)
```

## Prerequisites

- Install k6: `brew install k6` (macOS) or see https://k6.io/docs/get-started/installation/
- App running and seeded: `docker compose up -d && npm run db:seed`

## Run

```bash
npm run perf:smoke     # PROFILE=smoke  → home.js (1 VU, 5 iters)
npm run perf:load      # PROFILE=load   → home.js (steady 20 VUs)
npm run perf:stress    # PROFILE=stress → home.js (ramp to 200 VUs)
npm run perf:spike     # PROFILE=spike  → home.js (burst to 200 VUs)

# any feature × any profile × any target:
PROFILE=load API_URL=http://localhost:3001 k6 run perf/k6/scenarios/home.js
```

## SLOs (the gate)

Defined in `lib/thresholds.js`. If breached, k6 exits non-zero and the CI
`performance` gate fails:

| Metric                                  | Budget            |
| --------------------------------------- | ----------------- |
| `http_req_failed`                       | < 1% (smoke/load) |
| `http_req_duration` p95                 | < 500 ms (reads)  |
| `http_req_duration{endpoint:login}` p95 | < 800 ms (bcrypt) |
| `checks`                                | > 99% pass        |

## Observability (Grafana)

Stream metrics live to Prometheus → Grafana (see `observability/`):

```bash
# start the observability stack first
docker compose -f observability/docker-compose.observability.yml up -d

# run k6 with Prometheus remote-write output
npm run perf:smoke:grafana
# open Grafana at http://localhost:3030 (k6 dashboard pre-provisioned)
```
