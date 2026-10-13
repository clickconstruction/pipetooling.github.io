#!/usr/bin/env bash
# Runs supabase/tests/sub_flow against a throwaway copy of the WHOLE schema (the sub's flow, residential R8 · 12, PR 1
# of 3, after the residential flow).
#
#   npm run test:pg:sub-flow
#
# The same bed as scripts/pgtest-residential-flow.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the sub flow's migration once more, last, which must change nothing. It
# holds that migration's flow_fact_ids() and flows_seed(). The scenario, inside one transaction that rolls back: six
# flows, the sub one with its five steps in one Per job lane; Said yes a fork, no step with a reminder; the six sub
# facts last in the facts; the residential flow untouched; the migration once more mid-scenario (at its -- @rerun line,
# as a second push would) leaves an office's edit alone; and a flow seeded afresh adds the five steps once. It raises on
# its first failed assertion and ends with "sub_flow PASSED". PGTEST_KEEP=1 leaves the container up. Needs
# docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55494}"
NAME="pgtest-sub-flow"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
FIX="$(ls supabase/migrations/*_sub_flow.sql)"
SCENARIO="supabase/tests/sub_flow/20_scenario.sql"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }
grep -q '^-- @rerun$' "$SCENARIO" || { echo "$SCENARIO has no -- @rerun line"; exit 2; }

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

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
psql_as postgres -f - < "$FIX" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $FIX"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$({ sed -n '1,/^-- @rerun$/p' "$SCENARIO"; cat "$FIX"; sed -n '/^-- @rerun$/,$p' "$SCENARIO" | tail -n +2; } | psql_as postgres -f - 2>&1 || true)"
if ! grep -q "sub_flow PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "sub-flow bed ok"
