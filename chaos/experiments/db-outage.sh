#!/usr/bin/env bash
# Chaos experiment: DATABASE OUTAGE
#
# Hypothesis (steady state → turbulence → recovery):
#   1. Steady state: GET PROBE_PATH returns 200.
#   2. While Postgres is DOWN, the API must FAIL FAST — return a 5xx within
#      FAIL_FAST_SECONDS — and must NOT hang the request (no connection-pool
#      pile-up that exhausts the event loop).
#   3. After Postgres returns, the API must RECOVER to 200 on its own within
#      RECOVERY_ATTEMPTS×RECOVERY_INTERVAL seconds — without an app restart.
#
# A payments API that hangs (rather than fails fast) when its DB blips will
# exhaust connections and cascade; a 5xx in milliseconds is the resilient
# behaviour we assert here.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source lib/common.sh

FAIL_FAST_SECONDS="${FAIL_FAST_SECONDS:-5}"
RECOVERY_ATTEMPTS="${RECOVERY_ATTEMPTS:-15}"
RECOVERY_INTERVAL="${RECOVERY_INTERVAL:-2}"
rc=0
trap restore_db EXIT

echo "🧪 Chaos experiment: DB outage  (container=$DB_CONTAINER, probe=$PROBE_PATH)"

step "1. Steady state"
[ "$(login)" = "200" ] || { fail "login failed — is the app up at $API_URL?"; exit 1; }
read -r status time <<<"$(probe)"
if [ "$status" = "200" ]; then pass "steady state 200 in ${time}s"
else fail "no steady state (got $status) — aborting, nothing to perturb"; exit 1; fi

step "2. Turbulence — stop Postgres"
db_down; info "stopped $DB_CONTAINER"
read -r status time <<<"$(probe "$((FAIL_FAST_SECONDS + 3))")"
info "probe during outage: status=$status time=${time}s"
if [ "$status" = "000" ]; then
  fail "request HUNG past ${FAIL_FAST_SECONDS}s (no fast-fail) — resilience violation"; rc=1
elif awk "BEGIN{exit !($time > $FAIL_FAST_SECONDS)}"; then
  fail "responded $status but took ${time}s (> ${FAIL_FAST_SECONDS}s) — too slow to fail"; rc=1
elif [[ "$status" =~ ^5 ]]; then
  pass "failed fast with $status in ${time}s (no hang)"
else
  warn "unexpected $status during outage (expected 5xx fast-fail)"
fi

step "3. Recovery — restart Postgres"
db_up; info "started $DB_CONTAINER"
if attempts="$(wait_for_recovery "$RECOVERY_ATTEMPTS" "$RECOVERY_INTERVAL")"; then
  pass "auto-recovered to 200 after ${attempts} probe(s) (~$((attempts * RECOVERY_INTERVAL))s), no app restart"
else
  fail "did NOT recover within $((RECOVERY_ATTEMPTS * RECOVERY_INTERVAL))s — resilience violation"; rc=1
fi

echo
[ "$rc" -eq 0 ] && pass "DB-OUTAGE experiment PASSED" || fail "DB-OUTAGE experiment FAILED"
exit "$rc"
