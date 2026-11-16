#!/usr/bin/env bash
# Runs supabase/tests/property_lien_public_answer against set_property_lien_public_answer on stand-in tables (v2.7436).
#
#   npm run test:pg:property-lien-public-answer
#
# Is this public property? The answer on the property record (customer_addresses.lien_public_answer) and the press
# that takes its jobs off the lien path: who may answer, what each answer writes, what the press did and what it held
# a job at a time, the second press, and taking the answer back. The bed is the tables the function and the
# Collections flag touch, as the baseline types them, the real set_job_collections_flag lifted out of its migration,
# the migration (twice: a second run must change nothing) and the scenario. The scenario runs inside one transaction
# that rolls back, raises on its first failed assertion and ends with "property_lien_public_answer PASSED".
# Docker by default (GitHub's SQL beds workflow); PGTEST_PG_BIN=<dir of initdb/pg_ctl/psql> runs it on a
# local Postgres instead. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55799}"  # the local Postgres only; the container needs no port
NAME="pgtest-property-lien-public-answer"
BED="supabase/tests/property_lien_public_answer"
FLAG_SOURCE="supabase/migrations/20261007170000_job_uncollectible.sql"
MIGRATION="supabase/migrations/20261116221500_property_lien_public_answer.sql"
TMP="$(mktemp -d)"

# The Collections flag as prod runs it: the function's own statement, from its CREATE to its closing $function$;.
awk '/^CREATE OR REPLACE FUNCTION public\.set_job_collections_flag\(/ { on = 1 } on { print } on && /^\$function\$;/ { exit }' "$FLAG_SOURCE" > "$TMP/flag.sql"
grep -q "Job must be in Billed Awaiting Payment" "$TMP/flag.sql" || { echo "could not lift set_job_collections_flag out of $FLAG_SOURCE"; exit 2; }
tail -1 "$TMP/flag.sql" | grep -q '^\$function\$;' || { echo "set_job_collections_flag was lifted without its end"; exit 2; }
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
run_sql "$TMP/flag.sql" >/dev/null
run_sql "$MIGRATION" >/dev/null
# A second run of the migration must change nothing.
run_sql "$MIGRATION" >/dev/null
export PGOPTIONS=''
out="$(run_sql "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "property_lien_public_answer PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "property-lien-public-answer bed ok"
