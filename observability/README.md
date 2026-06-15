# Observability (k6 → Prometheus → Grafana)

Local observability stack that visualizes k6 performance runs in real time. This
is **our tooling** — it does not run the app under test.

## Stack

```
k6  --(remote-write)-->  Prometheus  <--(query)--  Grafana
                         :9090                     :3030
```

- **Prometheus** — accepts k6's `experimental-prometheus-rw` output (remote-write
  receiver enabled). Native histograms on for accurate p95/p99.
- **Grafana** — auto-provisions the Prometheus datasource and the
  `k6 Performance (RWA API)` dashboard (request rate, p95/p99 by endpoint, error
  rate, VUs, checks).

## Usage

```bash
# 1. start the stack
docker compose -f observability/docker-compose.observability.yml up -d

# 2. run a k6 scenario with Prometheus output
npm run perf:load:grafana          # or perf:smoke:grafana

# 3. open Grafana
open http://localhost:3030         # anonymous admin; dashboard pre-loaded
```

## Layout

```
observability/
  docker-compose.observability.yml
  prometheus/prometheus.yml
  grafana/
    provisioning/
      datasources/datasource.yml    ← Prometheus (uid: prometheus)
      dashboards/dashboards.yml      ← loads dashboards from disk
    dashboards/k6-performance.json   ← the k6 dashboard
```

## Tear down

```bash
docker compose -f observability/docker-compose.observability.yml down -v
```

> Tip: for richer panels you can also import the official k6 dashboard
> (Grafana.com ID **19665**) once the Prometheus datasource exists.
