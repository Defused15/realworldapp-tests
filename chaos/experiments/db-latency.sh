#!/usr/bin/env bash
# Chaos experiment: DATABASE LATENCY (slow dependency, not a hard outage)
#
# Hypothesis:
#   Under LATENCY_MS of injected network delay on the Postgres container, the
#   API must stay AVAILABLE — every probe still returns 200 (degraded, not
#   broken) and stays under DEGRADED_SLA_SECONDS. A slow dependency should slow
#   the app, never 5xx it.
#
# Network delay is injected with Pumba (github.com/alexei-led/pumba) using a
# throwaway `tc` sidecar image, so neither the app nor the Postgres image is
# modified (black-box, REGLA #1). Pumba removes the delay automatically when its
# --duration elapses; we also kill it on exit as a belt-and-braces cleanup.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source lib/common.sh

# Default to a MODERATE delay: the public feed fans out into several sequential
# DB round-trips, so latency is amplified (≈250ms/hop already pushes responses
# past 4s — see chaos/README.md "Findings"). 100ms keeps the steady-state
# hypothesis meaningful while still proving the app degrades, not breaks.
LATENCY_MS="${LATENCY_MS:-100}"
DURATION="${DURATION:-25s}"
DEGRADED_SLA_SECONDS="${DEGRADED_SLA_SECONDS:-3}"
SAMPLES="${SAMPLES:-6}"
PUMBA_IMAGE="${PUMBA_IMAGE:-gaiaadm/pumba:latest}"
TC_IMAGE="${TC_IMAGE:-gaiadocker/iproute2}"
rc=0
PUMBA_CID=""

cleanup() {
  [ -n "$PUMBA_CID" ] && docker rm -f "$PUMBA_CID" >/dev/null 2>&1 || true
  restore_db
}
trap cleanup EXIT

echo "🧪 Chaos experiment: DB latency  (+${LATENCY_MS}ms on $DB_CONTAINER for $DURATION)"

step "1. Steady state"
[ "$(login)" = "200" ] || { fail "login failed — is the app up at $API_URL?"; exit 1; }
read -r status base_time <<<"$(probe)"
[ "$status" = "200" ] && pass "steady state 200 in ${base_time}s" || { fail "no steady state ($status)"; exit 1; }

step "2. Turbulence — inject +${LATENCY_MS}ms on the DB network interface"
PUMBA_CID="$(docker run -d --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  "$PUMBA_IMAGE" netem --duration "$DURATION" --tc-image "$TC_IMAGE" \
  delay --time "$LATENCY_MS" "$DB_CONTAINER")" \
  || { warn "could not start Pumba (Docker socket / image pull?) — skipping experiment"; exit 0; }
info "pumba running ($PUMBA_CID); sampling ${SAMPLES} probes under latency"
sleep 2

worst=0; breaches=0; errors=0
for ((i = 1; i <= SAMPLES; i++)); do
  read -r status time <<<"$(probe "$((DEGRADED_SLA_SECONDS + 3))")"
  info "  sample $i: status=$status time=${time}s"
  [[ "$status" == 200 ]] || errors=$((errors + 1))
  awk "BEGIN{exit !($time > $worst)}" && worst="$time"
  awk "BEGIN{exit !($time > $DEGRADED_SLA_SECONDS)}" && breaches=$((breaches + 1))
  sleep 1
done

step "3. Verdict"
if [ "$errors" -gt 0 ]; then
  fail "$errors/$SAMPLES probes returned non-200 under latency — slow DB should degrade, not error"; rc=1
elif [ "$breaches" -gt 0 ]; then
  warn "$breaches/$SAMPLES probes exceeded ${DEGRADED_SLA_SECONDS}s (worst ${worst}s) — available but over degraded SLA"
else
  pass "stayed available under +${LATENCY_MS}ms (worst ${worst}s, all 200, all < ${DEGRADED_SLA_SECONDS}s)"
fi

echo
[ "$rc" -eq 0 ] && pass "DB-LATENCY experiment PASSED" || fail "DB-LATENCY experiment FAILED"
exit "$rc"
