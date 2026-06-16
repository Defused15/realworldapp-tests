# Chaos / resilience testing

Black-box **chaos engineering** for the RealWorld App: we inject infrastructure
failures from the _outside_ (stop containers, add network latency) and assert
the running app degrades gracefully instead of cascading. We never read or
modify the app source (REGLA #1) — experiments manipulate the Docker
infrastructure and probe the app over HTTP.

> Chaos testing answers a different question than the rest of the suite. UI/API
> tests ask _"does it work when everything is healthy?"_. Chaos asks _"what
> happens when a dependency breaks?"_ — the failure mode, not the happy path.

## Method

Every experiment follows the chaos-engineering loop:

1. **Steady state** — establish a healthy baseline (probe returns `200`).
2. **Turbulence** — inject a real fault into a dependency.
3. **Hypothesis** — assert the app's behaviour under fault matches what a
   resilient system _should_ do (fail fast, stay available, auto-recover).
4. **Restore** — always return the environment to health (an `EXIT` trap
   restarts the DB no matter how the script exits).

## Experiments

| Script                      | Fault injected                                 | Resilience hypothesis (PASS condition)                                                                                                 | Tool          |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `experiments/db-outage.sh`  | Stop the Postgres container, then restart it   | API **fails fast** (5xx in < 5s, no hang) during the outage **and auto-recovers** to 200 after the DB returns — without an app restart | `docker stop` |
| `experiments/db-latency.sh` | +100ms network delay on the Postgres interface | API **stays available** (every probe 200, slow ≠ broken) under a slow dependency                                                       | Pumba `netem` |

`run-all.sh` runs them in sequence and exits non-zero if any failed (so it can
gate nightly).

## Running

```bash
docker compose up -d            # app + Postgres must be running
npm run db:seed                 # known steady state

npm run chaos                   # run-all.sh — every experiment + summary
npm run chaos:db-outage         # single experiment
npm run chaos:db-latency        # single experiment (pulls Pumba on first run)
```

Tunable via env (defaults in `lib/common.sh` / each script):

| Var                    | Default                  | Meaning                                             |
| ---------------------- | ------------------------ | --------------------------------------------------- |
| `API_URL`              | `http://localhost:3001`  | App under test                                      |
| `DB_CONTAINER`         | `cypress-app-postgres-1` | Postgres container name (**CI overrides this**)     |
| `FAIL_FAST_SECONDS`    | `5`                      | Max time the API may take to error during an outage |
| `LATENCY_MS`           | `100`                    | Injected DB delay (db-latency)                      |
| `DEGRADED_SLA_SECONDS` | `3`                      | Soft latency budget under turbulence                |

> **macOS / local note:** the DB runs in Docker (`cypress-app-postgres-1`) while
> the API/web run as host `node` processes, so these experiments target the
> **database dependency** — the one piece that is containerised both locally and
> in CI. In CI (`app.ci.yml`) the whole stack is containerised; set
> `DB_CONTAINER` to the compose DB service name.

## Findings (2026-06-16)

- ✅ **Fail-fast on DB outage** — with Postgres down the API returns `500` in
  ~3ms instead of hanging; connections don't pile up. Good resilience.
- ✅ **Auto-recovery** — once Postgres is back the Prisma pool reconnects and the
  API serves `200` again on its own (~15–20s, no restart needed).
- ⚠️ **DB latency is heavily amplified** — just **+100ms** of DB delay pushes the
  public-feed response to **2–3.7s** (~30×). That ratio points to a sequential /
  N+1 query pattern on `GET /transactions/public`: each request makes many
  serial DB round-trips, so per-hop latency stacks up. The app stays _available_
  (no 5xx), but its tail latency is fragile under a slow database. Candidate for
  a performance bug write-up and a k6 latency-injection scenario.

## Tooling

- **Pumba** (`gaiaadm/pumba`) — chaos for Docker containers (kill, pause, netem).
  Network delay is applied with a throwaway `tc` sidecar image
  (`gaiadocker/iproute2`), so neither the app nor the Postgres image is modified.
- **`docker stop`/`start`** — for the hard-outage experiment (no extra tooling).
