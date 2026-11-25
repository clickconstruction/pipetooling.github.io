#!/usr/bin/env bash
# Runs supabase/tests/global_reload_dev_only against a stand-in for Realtime's own table (v2.8532).
#
#   npm run test:pg:global-reload-dev-only
#
# The two row policies of 20261124215500 on realtime.messages, on plain Postgres 15. The migration first runs on a
# database with no realtime.messages, where it must skip its policies and fail nothing (the whole-schema beds have no
# Realtime service). Then 00_schema.sql stands in for the table, the migration is applied twice (a second run must
# change nothing) and the scenario runs in one transaction that rolls back, ending with "global_reload_dev_only
# PASSED". Needs docker (the SQL beds workflow runs it on GitHub's runners); PGTEST_PG_BIN=<postgres bin> runs it on a
# local Postgres instead. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55561}"
NAME="pgtest-global-reload-dev-only"
BED="supabase/tests/global_reload_dev_only"
MIGRATION="supabase/migrations/20261124215500_global_reload_dev_only.sql"
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

# With no Realtime table the migration says so and makes nothing.
export PGOPTIONS=''
out="$(run_sql "$MIGRATION" 2>&1)" || { echo "the migration failed on a database with no realtime.messages"; echo "$out" | tail -20; exit 1; }
if ! grep -q "the Global Reload policies were not made" <<<"$out"; then echo "the migration did not say it skipped its policies"; echo "$out" | tail -20; exit 1; fi
echo "ok: with no realtime.messages the migration skips its policies and fails nothing"

export PGOPTIONS='-c client_min_messages=warning'
run_sql "$BED/00_schema.sql" >/dev/null
run_sql "$MIGRATION" >/dev/null
# A second run of the migration must change nothing.
run_sql "$MIGRATION" >/dev/null
export PGOPTIONS=''
out="$(run_sql "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "global_reload_dev_only PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "global-reload-dev-only bed ok"
