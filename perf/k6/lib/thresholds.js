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
