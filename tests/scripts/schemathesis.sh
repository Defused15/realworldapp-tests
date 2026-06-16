#!/usr/bin/env bash
# Property / fuzz testing of the API with Schemathesis, driven by the hand-authored
# OpenAPI spec (docs/api/openapi.yaml — the app ships none).
#
# Logs in to obtain a session cookie, then fuzzes every operation. /logout is
# excluded so the session stays valid for the whole run.
#
# Known app bugs (docs/bug-reports/bugs.yml → BUG-API-FUZZ-00x) are EXCLUDED by
# operationId below so this job is a *regression gate*: green while only the
# already-filed 500s exist, red the moment a NEW server error appears on any
# other operation. The excluded ops stay tracked as GitHub issues; drop an id
# from EXCLUDED_OPS once the app fixes it. (We can't patch the app — REGLA #1.)
#
# Env:
#   API_URL                (default http://localhost:3001)
#   TEST_USER_USERNAME     (default Heath93)
#   TEST_USER_PASSWORD     (default s3cret)
#   SCHEMATHESIS_CHECKS    (default not_a_server_error — the meaningful gate: no 5xx)
#   SCHEMATHESIS_EXAMPLES  (default 15)
set -euo pipefail

API="${API_URL:-http://localhost:3001}"
USER="${TEST_USER_USERNAME:-Heath93}"
PASS="${TEST_USER_PASSWORD:-s3cret}"
CHECKS="${SCHEMATHESIS_CHECKS:-not_a_server_error}"
EXAMPLES="${SCHEMATHESIS_EXAMPLES:-15}"

COOKIE=$(curl -s -i -X POST "$API/login" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"LOGIN\",\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | grep -i '^set-cookie:' | sed -E 's/[Ss]et-[Cc]ookie: ([^;]+).*/\1/' | head -1)

if [ -z "$COOKIE" ]; then
  echo "::error::Could not obtain a session cookie from $API/login"
  exit 1
fi

# Operations with a known, already-filed app bug. Each maps to a BUG-API-FUZZ-00x
# entry in docs/bug-reports/bugs.yml. Excluded so the gate fails only on NEW 500s.
EXCLUDED_OPS=(
  createUser              # BUG-API-FUZZ-001  POST /users (wrong-typed body → 500)
  updateUser              # BUG-API-FUZZ-009  PATCH /users/{id} (wrong-typed body → 500; also corrupts seed user)
  createTransaction       # BUG-API-FUZZ-002  POST /transactions (bad receiverId → 500)
  createNotificationsBulk # BUG-API-FUZZ-003  POST /notifications/bulk (non-array → 500)
  getPublicTransactions   # BUG-API-FUZZ-004  GET /transactions/public (unknown param → 500)
  getContactsByUsername   # BUG-API-FUZZ-005  GET /contacts/{username} (unknown user → 500)
  updateTransaction       # BUG-API-FUZZ-007  PATCH /transactions/{id} (null-deref → 500)
  likeTransaction         # BUG-API-FUZZ-007  POST /likes/{id} (null-deref → 500)
  commentTransaction      # BUG-API-FUZZ-007  POST /comments/{id} (null-deref → 500)
)
EXCLUDE_FLAGS=()
for op in "${EXCLUDED_OPS[@]}"; do EXCLUDE_FLAGS+=(--exclude-operation-id "$op"); done

# --network host so the container reaches the app on the CI runner's localhost.
# (Locally on macOS use API_URL=http://host.docker.internal:3001 instead.)
# The HTML coverage report lands in ./schemathesis-out on the host (writable
# working-dir mount) so CI can upload it as an artifact.
mkdir -p "$PWD/schemathesis-out" && chmod 777 "$PWD/schemathesis-out"
docker run --rm --network host \
  -v "$PWD/docs/api:/spec:ro" \
  -v "$PWD/schemathesis-out:/wrk" -w /wrk \
  schemathesis/schemathesis:stable run /spec/openapi.yaml \
  --url "$API" \
  -H "Cookie: $COOKIE" \
  --exclude-path /logout \
  "${EXCLUDE_FLAGS[@]}" \
  -c "$CHECKS" \
  -n "$EXAMPLES"
