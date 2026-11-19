#!/usr/bin/env bash
# Runs supabase/tests/lien_closed_days against the lien affidavit readers on stand-in tables (v2.7817).
#
#   npm run test:pg:lien-closed-days
#
# A lien day that passed with nothing filed stays listed until someone answers it: list_lien_closed_days lists a job
# whose last day to file is more than seven days past, with no filed affidavit, still on the lien path, and
# list_lien_affidavit_windows answers what it answered before. The bed is the lien_hand_day bed's stand-in tables, the
# two days a bill carries (the lien_bill_months bed's), the job's lien path answer, the two real deadline functions and
# the readers as 20261113200000 left them (after 20261113190000, as the lien_bill_months bed applies them). The
# windows reader of that file is then kept under the name list_lien_affidavit_windows_before, the migration is applied
# (twice: a second run must change nothing), and the scenario asks both for the same rows in the same order on every
# step. The scenario runs inside one transaction that rolls back, raises on its first failed assertion and ends with
# "lien_closed_days PASSED".
# Docker by default (GitHub's SQL beds workflow); PGTEST_PG_BIN=<dir of initdb/pg_ctl/psql> runs it on a
# local Postgres instead. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55469}"  # the local Postgres only; the container needs no port
NAME="pgtest-lien-closed-days"
BED="supabase/tests/lien_closed_days"
BASE="supabase/tests/lien_hand_day"
BILLS="supabase/tests/lien_bill_months"
DEADLINES="supabase/migrations/20261010001000_lien_blank_kind_residential.sql"
HAND_DAY="supabase/migrations/20261113190000_lien_hand_day_counts.sql"
BEFORE="supabase/migrations/20261113200000_lien_months_from_bill.sql"
MIGRATION="supabase/migrations/20261118230000_lien_closed_days.sql"
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
run_sql "$BASE/00_schema.sql" >/dev/null
run_sql "$BILLS/10_bills.sql" >/dev/null
run_sql "$BED/10_path.sql" >/dev/null
run_sql "$DEADLINES" >/dev/null
run_sql "$HAND_DAY" >/dev/null
run_sql "$BEFORE" >/dev/null
# The windows reader as it stood, kept under another name, so the scenario can ask both.
run_sql "$BED/15_before.sql" >/dev/null
run_sql "$MIGRATION" >/dev/null
# A second run of the migration must change nothing.
run_sql "$MIGRATION" >/dev/null
export PGOPTIONS=''
out="$(run_sql "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "lien_closed_days PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "lien-closed-days bed ok"
