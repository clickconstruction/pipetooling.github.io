#!/usr/bin/env bash
# Runs supabase/tests/dev_query_plan against a throwaway copy of the WHOLE schema (a dev reads the plan of a fixed
# statement as themself, punch list #430, migration *_dev_query_plan).
#
#   npm run test:pg:dev-query-plan
#
# The same bed as scripts/pgtest-people-hours-recorded.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the function's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: the function runs as its caller, is closed to anon and holds no
# dynamic SQL; no session, the assistant and a crew member are refused; an unknown key, and a real key with SQL after
# it, are refused and delete nothing; a dev gets each statement's plan, analyzed and not, the plan alone line for line
# what the same EXPLAIN gives them directly; and a write after a call is refused by the database. It raises on its first
# failed assertion and ends with "dev_query_plan PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55922}"
NAME="pgtest-dev-query-plan"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
FN="$(ls supabase/migrations/*_dev_query_plan.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
. scripts/pgtest-pull.sh
pgtest_pull_supabase "$IMAGE"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
# psql's errors go to this run's own file: a fixed /tmp name may belong to another user on a shared Mac.
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"
trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1; rm -f "$ERR"' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

pgtest_migrate
# A second run must change nothing: CREATE OR REPLACE FUNCTION with the same signature.
psql_as postgres -f - < "$FN" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $FN"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/dev_query_plan/20_scenario.sql 2>&1 || true)"
if ! grep -q "dev_query_plan PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "dev-query-plan bed ok"
