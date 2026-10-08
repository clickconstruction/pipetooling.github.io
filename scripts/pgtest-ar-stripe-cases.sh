#!/usr/bin/env bash
# Runs supabase/tests/ar_stripe_cases against stand-in tables (v2.4950, punch list #76 piece 1).
#
#   npm run test:pg:ar-stripe-cases
#
# record_ar_stripe_case, the triggers that close a case, put_back_lost_dispute_bill, the office's
# close and reopen and the list rows, on plain Postgres 15: 00_schema.sql stands in for the tables
# and auth helpers, the list body's _ar_try_timestamptz is lifted from 20261001230000, the unbanked
# migration (20261008100000) lays the list's second table, then the migration is applied twice (a
# second run must change nothing) and the scenario runs in one transaction that rolls back, ending
# with "ar_stripe_cases PASSED". Needs docker (the SQL beds workflow runs it on
# GitHub's runners); PGTEST_PG_BIN=/usr/local/opt/postgresql@15/bin runs it on a local
# Postgres 15 instead. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55453}"  # the local Postgres only; the container needs no port
NAME="pgtest-ar-stripe-cases"
BED="supabase/tests/ar_stripe_cases"
CASES="supabase/migrations/20261001230000_ar_returned_check_cases.sql"
UNBANKED="supabase/migrations/20261008100000_ar_unbanked_check_cases.sql"
MIGRATION="supabase/migrations/20261009080000_ar_stripe_cases.sql"
TMP="$(mktemp -d)"

python3 - "$CASES" "$TMP/10_helpers.sql" <<'PY'
import re, sys
src = open(sys.argv[1]).read()
m = re.search(r'CREATE OR REPLACE FUNCTION public\._ar_try_timestamptz\(.*?\n\$function\$;\n', src, re.S)
if not m:
    sys.exit('could not find _ar_try_timestamptz in ' + sys.argv[1])
open(sys.argv[2], 'w').write(m.group(0))
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
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg postgres:15 >/dev/null
  trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
  for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
  sleep 2
  run_sql() { docker exec -i -e PGPASSWORD=pg -e PGOPTIONS="${PGOPTIONS:-}" "$NAME" psql -U postgres -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 -f - < "$1"; }
fi

# Setup and the migration quietly; the scenario keeps its notices (they carry the "ok:" lines).
export PGOPTIONS='-c client_min_messages=warning'
run_sql "$BED/00_schema.sql" >/dev/null
run_sql "$TMP/10_helpers.sql" >/dev/null
run_sql "$UNBANKED" >/dev/null
run_sql "$MIGRATION" >/dev/null
# A second run of the migration must change nothing.
run_sql "$MIGRATION" >/dev/null
export PGOPTIONS=''
out="$(run_sql "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "ar_stripe_cases PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "ar-stripe-cases bed ok"
