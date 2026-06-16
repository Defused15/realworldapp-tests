# Shared helpers for chaos experiments. Source this, do not execute.
# Black-box only (REGLA #1): we manipulate infrastructure containers from the
# outside and probe the app over HTTP — never the app source.

API_URL="${API_URL:-http://localhost:3001}"
DB_CONTAINER="${DB_CONTAINER:-cypress-app-postgres-1}" # CI overrides via env
TEST_USER_USERNAME="${TEST_USER_USERNAME:-Heath93}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-s3cret}"
PROBE_PATH="${PROBE_PATH:-/transactions/public}" # authed read; representative steady-state
COOKIE_JAR="$(mktemp)"

# ── tiny logger ────────────────────────────────────────────────────────────
c_reset=$'\e[0m'; c_red=$'\e[31m'; c_grn=$'\e[32m'; c_ylw=$'\e[33m'; c_blu=$'\e[34m'
info()  { echo "${c_blu}ℹ${c_reset}  $*"; }
pass()  { echo "${c_grn}✅ $*${c_reset}"; }
fail()  { echo "${c_red}❌ $*${c_reset}"; }
warn()  { echo "${c_ylw}⚠️  $*${c_reset}"; }
step()  { echo; echo "${c_blu}── $* ──${c_reset}"; }

# Authenticate once, store the session cookie in COOKIE_JAR.
login() {
  curl -s -c "$COOKIE_JAR" -X POST "$API_URL/login" \
    -H 'Content-Type: application/json' \
    -d "{\"type\":\"LOGIN\",\"username\":\"$TEST_USER_USERNAME\",\"password\":\"$TEST_USER_PASSWORD\"}" \
    -o /dev/null -w '%{http_code}'
}

# probe → echoes "<http_status> <time_total_seconds>". Never hangs past -m.
# On timeout curl emits "000 <elapsed>" AND exits non-zero; we keep that output
# (|| true) instead of appending a second fallback line.
probe() {
  local timeout="${1:-8}" out
  out="$(curl -s -b "$COOKIE_JAR" -m "$timeout" -o /dev/null \
    -w '%{http_code} %{time_total}' "$API_URL$PROBE_PATH" 2>/dev/null)" || true
  [ -n "$out" ] && echo "$out" || echo "000 ${timeout}.0"
}

# Block until the API serves a 200 again (recovery), or give up.
# Args: max_attempts interval_seconds. Echoes attempts used; returns non-zero on giving up.
wait_for_recovery() {
  local max="${1:-15}" interval="${2:-2}" i status
  for ((i = 1; i <= max; i++)); do
    status="$(probe 8 | cut -d' ' -f1)"
    if [ "$status" = "200" ]; then echo "$i"; return 0; fi
    sleep "$interval"
  done
  echo "$max"; return 1
}

db_up()   { docker start "$DB_CONTAINER" >/dev/null 2>&1 || true; }
db_down() { docker stop  "$DB_CONTAINER" >/dev/null 2>&1; }

# Always leave the DB running, no matter how the experiment exits.
# Each experiment installs this as its EXIT trap.
restore_db() {
  db_up
  # give the pool a moment so the next caller (or run-all) sees a healthy app
  wait_for_recovery 15 2 >/dev/null || warn "DB restarted but API not yet serving 200"
  rm -f "$COOKIE_JAR"
}
