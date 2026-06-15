// perf/k6/scenarios/signup.js
//
// Feature: signup (POST /users) — account creation.
//
// WHY THIS IS SMOKE-ONLY (Phase 0 decision):
//   signup is NOT a money path and NOT a hot path. A user registers once, ever
//   — it is the lowest-frequency write in the app, the inverse of a hot path.
//   It is a single INSERT + a synchronous bcrypt hash; no joins, no pagination,
//   no contention. By the inclusion criteria it scores zero, so a load/stress/
//   spike profile would be coverage theater (high-throughput signup is unreal).
//
//   The ONE reason it is measured at all: it is the only unauthenticated write,
//   and it runs bcrypt (cost factor 10) on the request path — the classic cheap
//   CPU-DoS surface of an auth system. So we keep a SMOKE-ONLY tripwire to catch
//   a silent latency regression (e.g. a bumped bcrypt cost). The thresholds are
//   the gate; there is intentionally no throughput SLO.
//
//   Profile: forced to `smoke` — PROFILE=load|stress|spike is ignored (warned).
//   SLO: signupSlo — p95 latency tripwire (<800ms) + <1% errors + checks>99%.

import {sleep} from 'k6';
import {signupJourney} from '../lib/journey.js';
import {profiles} from '../lib/profiles.js';
import {signupSlo} from '../lib/thresholds.js';

// Signup is deliberately pinned to smoke regardless of PROFILE. Driving a
// once-per-user-ever write at load/stress/spike concurrency measures nothing
// real; it would only flood the DB with junk users and bcrypt CPU.
const requested = __ENV.PROFILE || 'smoke';
if (requested !== 'smoke') {
  console.warn(
    `[signup] PROFILE="${requested}" ignored — signup is measured smoke-only ` +
      `(low-frequency write; no throughput SLO). Running 'smoke'.`,
  );
}

export const options = {
  ...profiles.smoke,
  thresholds: signupSlo,
};

export default function () {
  signupJourney();
  sleep(1);
}
