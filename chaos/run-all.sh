#!/usr/bin/env bash
# Run every chaos experiment in sequence and print a summary.
# Each experiment restores the DB on its own exit, so a failure in one does not
# leave the environment broken for the next. Exit non-zero if any failed, so
# this can act as a (nightly) resilience gate.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

experiments=(experiments/db-outage.sh experiments/db-latency.sh)
declare -a results
overall=0

for exp in "${experiments[@]}"; do
  echo "════════════════════════════════════════════════════════════════════"
  if bash "$exp"; then results+=("PASS  $exp"); else overall=1; results+=("FAIL  $exp"); fi
done

echo "════════════════════════════════════════════════════════════════════"
echo "Chaos summary:"
for r in "${results[@]}"; do echo "  $r"; done
[ "$overall" -eq 0 ] && echo "All chaos experiments passed." || echo "One or more chaos experiments FAILED."
exit "$overall"
