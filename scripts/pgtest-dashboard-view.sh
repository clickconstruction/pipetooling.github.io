#!/usr/bin/env bash
# Runs supabase/tests/dashboard_view against a throwaway copy of the WHOLE schema (Job Mode, short, punch list #384
# PR 1: set_dashboard_view opened to a superintendent's account and to a person's own row).
#
#   npm run test:pg:dashboard-view
#
# The same bed as scripts/pgtest-my-money-strip.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the function's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: the office sets a leader, a dev and a superintendent, a
# superintendent sets his own row and nobody else's, a role that takes no view is refused on its own row, and a
# training account, a twin, an unknown view, an unknown id and nobody signed in are each refused in words with the row
# left as it was. It raises on its first failed assertion and ends with "dashboard_view PASSED". PGTEST_KEEP=1 leaves
# the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a
# migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55848}"
NAME="pgtest-dashboard-view"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_dashboard_view_superintendent.sql)"

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
# A second run must change nothing: CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/dashboard_view/20_scenario.sql 2>&1 || true)"
if ! grep -q "dashboard_view PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "dashboard-view bed ok"
