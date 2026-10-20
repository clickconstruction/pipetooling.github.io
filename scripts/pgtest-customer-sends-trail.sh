#!/usr/bin/env bash
# Runs supabase/tests/customer_sends_trail against stand-in tables (v2.5636).
#
#   npm run test:pg:customer-sends-trail
#
# The four triggers of 20261019030000 (contract reminders, demand letters, lien notices, paper bill resends) and
# their backfill, on plain Postgres 15: 00_schema.sql stands in for the tables, 10_seed.sql is what prod holds
# before the migration (one row for each way a send can read), the migration is applied twice (a second run must
# change nothing) and the scenario runs in one transaction that rolls back, ending with "customer_sends_trail
# PASSED". Needs docker (the SQL beds workflow runs it on GitHub's runners); PGTEST_PG_BIN=<postgres 15 bin> runs it
# on a local Postgres instead. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55532}"
NAME="pgtest-customer-sends-trail"
BED="supabase/tests/customer_sends_trail"
MIGRATION="supabase/migrations/20261019030000_customer_sends_to_activity.sql"
TMP="$(mktemp -d)"

if [ -n "${PGTEST_PG_BIN:-}" ]; then
  DATA="$TMP/data"
  LC_ALL=C "$PGTEST_PG_BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
  LC_ALL=C "$PGTEST_PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k ''" -l "$TMP/pg.log" -w start >/dev/null
  trap 'LC_ALL=C "$PGTEST_PG_BIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1; rm -rf "$TMP"' EXIT
  run_sql() { "$PGTEST_PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -f - < "$1"; }
else
  command -v docker >/dev/null || { echo "docker not on PATH (or set PGTEST_PG_BIN)"; exit 2; }
  docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  . scripts/pgtest-pull.sh
  pgtest_pull_postgres15
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg postgres:15 >/dev/null
  trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
  for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
  sleep 2
  run_sql() { docker exec -i -e PGPASSWORD=pg -e PGOPTIONS="${PGOPTIONS:-}" "$NAME" psql -U postgres -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 -f - < "$1"; }
fi

export PGOPTIONS='-c client_min_messages=warning'
run_sql "$BED/00_schema.sql" >/dev/null
run_sql "$BED/10_seed.sql" >/dev/null
run_sql "$MIGRATION" >/dev/null
# A second run of the migration must change nothing.
run_sql "$MIGRATION" >/dev/null
export PGOPTIONS=''
out="$(run_sql "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "customer_sends_trail PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "customer-sends-trail bed ok"
