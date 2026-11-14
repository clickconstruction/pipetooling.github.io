#!/usr/bin/env bash
# Runs supabase/tests/lien_hand_day against the four lien readers on stand-in tables (v2.7193).
#
#   npm run test:pg:lien-hand-day
#
# The day set by hand counts (punch list #335, row 1): list_lien_notice_months, list_lien_affidavit_windows,
# list_gc_unpaid_months and list_jobs_owner_to_confirm take a job's last month from jobs_ledger.lien_last_work_on
# when it is set, and leave months of approved hours after it off the clock. The bed is the tables those four read,
# as the baseline types them, the two real deadline functions, the migration (twice: a second run must change
# nothing) and a scenario that asserts what the client's lienClockMonths tests assert. The scenario runs inside one
# transaction that rolls back, raises on its first failed assertion and ends with "lien_hand_day PASSED".
# Docker by default (GitHub's SQL beds workflow); PGTEST_PG_BIN=<dir of initdb/pg_ctl/psql> runs it on a
# local Postgres instead. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55467}"  # the local Postgres only; the container needs no port
NAME="pgtest-lien-hand-day"
BED="supabase/tests/lien_hand_day"
DEADLINES="supabase/migrations/20261010001000_lien_blank_kind_residential.sql"
MIGRATION="supabase/migrations/20261113190000_lien_hand_day_counts.sql"
TMP="$(mktemp -d)"

if [ -n "${PGTEST_PG_BIN:-}" ]; then
  DATA="$TMP/data"
  LC_ALL=C "$PGTEST_PG_BIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
  LC_ALL=C "$PGTEST_PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k ''" -l "$TMP/pg.log" -w start >/dev/null
  trap 'LC_ALL=C "$PGTEST_PG_BIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1; rm -rf "$TMP"' EXIT
  # Another session's Postgres may already hold the port; never run the bed on a server that is not this one.
  got="$("$PGTEST_PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -A -t -c "SELECT current_setting('data_directory')")"
  [ "$got" = "$DATA" ] || { echo "port $PORT answers from $got, not this bed; set PGTEST_PORT"; exit 2; }
  run_sql() { "$PGTEST_PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 -f - < "$1"; }
else
  command -v docker >/dev/null || { echo "docker not on PATH (or set PGTEST_PG_BIN)"; exit 2; }
  docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg postgres:15 >/dev/null
  trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
  for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
  sleep 2
  run_sql() { docker exec -i -e PGPASSWORD=pg -e PGOPTIONS="${PGOPTIONS:-}" "$NAME" psql -U postgres -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 -f - < "$1"; }
fi

export PGOPTIONS='-c client_min_messages=warning'
run_sql "$BED/00_schema.sql" >/dev/null
run_sql "$DEADLINES" >/dev/null
run_sql "$MIGRATION" >/dev/null
# A second run of the migration must change nothing.
run_sql "$MIGRATION" >/dev/null
export PGOPTIONS=''
out="$(run_sql "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "lien_hand_day PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "lien-hand-day bed ok"
