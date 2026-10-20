#!/usr/bin/env bash
# Runs supabase/tests/revenue_riders against stand-in tables (v2.5129, a turnaway trip charge as a rider).
#
#   npm run test:pg:revenue-riders
#
# job_rider_fees, create_turnaway_trip_charge and apply_job_discount, on plain Postgres 15: 00_schema.sql stands in
# for the tables and helpers they read; the three functions as main defined them before this bed's migration are
# lifted from their migrations (job_rider_fees from 20261010026000, create_turnaway_trip_charge from 20260927230000,
# apply_job_discount from 20261010023000); 15_seed.sql makes trip charges through them; then the migration is applied
# twice (a second run must change nothing), then 20261010062000 (v2.5144, a deleted bill gives its returned check fee
# back to its case) twice, and the scenario runs in one transaction that rolls back, ending with
# "revenue_riders PASSED". Needs docker (the SQL beds workflow runs it on GitHub's runners);
# PGTEST_PG_BIN=/usr/local/opt/postgresql@15/bin runs it on a local Postgres 15 instead. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55457}"  # the local Postgres only; the container needs no port
NAME="pgtest-revenue-riders"
BED="supabase/tests/revenue_riders"
MIGRATION="supabase/migrations/20261010044000_trip_charge_rider.sql"
MIGRATION_CASE_FEE="supabase/migrations/20261010062000_case_fee_back_on_bill_delete.sql"
TMP="$(mktemp -d)"

python3 - "$TMP/10_main_functions.sql" <<'PY'
import re, sys
lifts = [
    ('supabase/migrations/20261010026000_gc_owner_card_bills.sql', r'CREATE OR REPLACE FUNCTION public\.job_rider_fees\(', '$function$;'),
    ('supabase/migrations/20260927230000_controller_money_functions.sql', r'CREATE OR REPLACE FUNCTION public\.create_turnaway_trip_charge\(', '$function$;'),
    ('supabase/migrations/20261010023000_revenue_keeps_check_fee.sql', r'create or replace function public\.apply_job_discount\(', '$$;'),
]
out = []
for path, start, end in lifts:
    m = re.search(start + r'.*?\n' + re.escape(end) + r'\n', open(path).read(), re.S)
    if not m:
        sys.exit('could not find ' + start + ' in ' + path)
    out.append(m.group(0))
open(sys.argv[1], 'w').write('\n'.join(out))
PY

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

# Setup, the seed and the migration quietly; the scenario keeps its notices (they carry the "ok:" lines).
export PGOPTIONS='-c client_min_messages=warning'
run_sql "$BED/00_schema.sql" >/dev/null
run_sql "$TMP/10_main_functions.sql" >/dev/null
run_sql "$BED/15_seed.sql" >/dev/null
run_sql "$MIGRATION" >/dev/null
# A second run of the migration must change nothing.
run_sql "$MIGRATION" >/dev/null
run_sql "$MIGRATION_CASE_FEE" >/dev/null
run_sql "$MIGRATION_CASE_FEE" >/dev/null
export PGOPTIONS=''
out="$(run_sql "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "revenue_riders PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "revenue-riders bed ok"
