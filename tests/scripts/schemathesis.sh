#!/usr/bin/env bash
# Property / fuzz testing of the API with Schemathesis, driven by the hand-authored
# OpenAPI spec (docs/api/openapi.yaml — the app ships none).
#
# Logs in to obtain a session cookie, then fuzzes every operation. /logout is
# excluded so the session stays valid for the whole run.
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
  -c "$CHECKS" \
  -n "$EXAMPLES"
