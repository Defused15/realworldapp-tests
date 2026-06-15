// perf/k6/scenarios/transaction.js
// Performance scenario for the TRANSACTION feature (one file per feature, like
// the UI/API/DB layers). The transaction feature is the app's core money path:
// reads (public feed + transaction detail) are the hottest path, and the write
// (POST /transactions) is a money path under write contention. Both are measured.
//
// The load shape is chosen at runtime — NOT by separate files:
//   PROFILE=smoke  k6 run perf/k6/scenarios/transaction.js   (default, CI gate)
//   PROFILE=load   k6 run perf/k6/scenarios/transaction.js   (baseline regression)
//   PROFILE=stress k6 run perf/k6/scenarios/transaction.js   (nightly, find the knee)
//   PROFILE=spike  k6 run perf/k6/scenarios/transaction.js   (nightly, burst recovery)
//
// ─────────────────────────────────────────────────────────────────────────────
// Phase 0 — DECISION TABLE (measure by risk, not by completeness)
//
//   Flow                              | Measure? | Criterion / reason
//   ----------------------------------|----------|----------------------------------------------
//   public feed (paginated)           | YES      | hot path + joins/pagination (heavy read) → load+stress
//   transaction detail (likes/comm.)  | YES      | hot read, joined likes+comments payload → load+stress
//   create transaction (pay/request)  | YES      | MONEY PATH + write under contention → load+stress+spike
//   like a transaction (POST /likes)  | NO       | low value/iter, no dedup (BUG-005); not a money/SLA path
//   comment (POST /comments)          | NO       | low-frequency social write, no SLA
//   accept/reject request (PATCH)     | NO       | low-frequency status flip, not a hot path
//   amount filter (feed?amountMin..)  | NO       | covered by the public-feed read path (same query shape)
//   date filter (feed?dateStart..)    | NO       | BUG-HOME-001 → server 500; broken, nothing to measure
//
// Only the three YES flows have journeys. The write uses transactionType
// "request" so it exercises the full INSERT path without moving real balance.
// ─────────────────────────────────────────────────────────────────────────────
//
// Traffic mix per iteration: ~80% read / ~20% write — reads dominate a real
// feed-driven app, and we still keep the money path continuously under load so
// its p95 and error rate are gated. The mix is constant across every PROFILE.

import {sleep} from 'k6';
import {
  transactionReadJourney,
  transactionWriteJourney,
} from '../lib/journey.js';
import {profile} from '../lib/profiles.js';
import {transactionSlo} from '../lib/thresholds.js';

export const options = {
  ...profile(), // smoke | load | stress | spike (via PROFILE env)
  thresholds: transactionSlo, // SLOs = the gate; breach → k6 exits non-zero
};

export default function () {
  // Every 5th iteration exercises the write (money path); the rest read. Using
  // __ITER (not Math.random) keeps the ~20% mix deterministic, so even the tiny
  // smoke run (5 iters) is guaranteed to hit the create-transaction path once.
  if (__ITER % 5 === 0) {
    transactionWriteJourney();
  } else {
    transactionReadJourney();
  }
  sleep(1);
}
