// perf/k6/lib/thresholds.js
// SLOs shared by every scenario. These ARE the performance gate: if a threshold
// is breached, k6 exits non-zero and the CI `performance` gate fails the build.
//
// Tune these as real baselines emerge. Per-endpoint overrides use k6 tag syntax
// `metric{tag:value}` and require the matching `tags: { endpoint: '...' }` on
// the request.

export const slo = {
  // <1% of requests may fail (non-2xx/3xx).
  http_req_failed: ['rate<0.01'],
  // Latency budget for read endpoints.
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  // >99% of functional checks must pass.
  checks: ['rate>0.99'],
};

// Auth is heavier (bcrypt). Allow a wider budget on the login endpoint only.
export const authSlo = {
  ...slo,
  'http_req_duration{endpoint:login}': ['p(95)<800'],
  'http_req_duration{endpoint:feed}': ['p(95)<500'],
  'http_req_duration{endpoint:transaction}': ['p(95)<400'],
};

// Signin scenario SLO. /login is the auth money path: every user hits it and it
// is bcrypt-bound, so it gets the widest latency budget in the suite (p95<800).
// The 401 rejection path shares the same endpoint tag. Note: the mixed scenario
// intentionally drives ~10% 401s, so the global http_req_failed rate would trip
// the <1% rule — we scope failure to non-auth requests via a custom check and
// keep the duration SLO as the real gate. (k6 counts 401 as http_req_failed.)
export const signinSlo = {
  'http_req_duration{endpoint:login}': ['p(95)<800', 'p(99)<1500'],
  // Functional checks (200/401/cookie) must hold >99% — this is the real gate.
  checks: ['rate>0.99'],
};

// Signup scenario SLO. signup is a low-frequency write (one-per-user-ever), NOT
// a money/hot path — it is measured smoke-only, purely as a regression tripwire.
// It runs bcrypt synchronously on the request path, so the one thing worth
// guarding is latency: catch a silent regression (e.g. a bumped bcrypt cost
// factor). Budget is deliberately generous (baseline ~85ms locally); this is a
// tripwire, not a throughput SLO. No load/stress/spike profile is appropriate.
export const signupSlo = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  'http_req_duration{endpoint:signup}': ['p(95)<800'],
};

// Transaction scenario SLO. Reads (feed/detail) keep the standard read budget;
// the write (POST /transactions) is the money path under contention and gets its
// own, slightly wider budget — auth check + payload validation + DB insert. The
// `users`/`bankaccounts` lookups in the write journey are memoized per-VU so
// they barely register; they inherit the global read budget.
export const transactionSlo = {
  ...slo,
  'http_req_duration{endpoint:login}': ['p(95)<800'],
  'http_req_duration{endpoint:feed}': ['p(95)<500'],
  'http_req_duration{endpoint:transaction}': ['p(95)<400'],
  'http_req_duration{endpoint:create-transaction}': ['p(95)<600'],
};
