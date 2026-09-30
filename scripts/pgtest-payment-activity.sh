#!/usr/bin/env bash
# Runs supabase/tests/payment_activity against a throwaway Postgres 15 in Docker (v2.4269).
#
#   npm run test:pg:payment-activity
#
# The bed is a stand-in schema carrying the OLD payment→activity trigger (00_schema.sql), the
# bug-era history it made (10_before.sql), then the fix migration, then every scenario, each raising
# on its first failed assertion and ending with a "… PASSED" notice. Needs docker and psql on PATH.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55434}"
NAME="pgtest-payment-activity"
BED="supabase/tests/payment_activity"
MIGRATION="supabase/migrations/20260930213000_payment_removed_when_removed.sql"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
command -v psql >/dev/null || { echo "psql not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" postgres:15 >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 60); do pg_isready -h localhost -p "$PORT" -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
export PGPASSWORD=pg
PSQL=(psql -h localhost -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$BED/00_schema.sql"
"${PSQL[@]}" -f "$BED/10_before.sql" 2>&1 | grep -E "PASSED|ERROR|CONTEXT"
"${PSQL[@]}" -f "$MIGRATION"
# A second run of the migration must change nothing (the correction is guarded).
"${PSQL[@]}" -f "$MIGRATION"
"${PSQL[@]}" -f "$BED/20_scenarios.sql" 2>&1 | grep -E "PASSED|ERROR|CONTEXT"
echo "payment-activity bed ok"
