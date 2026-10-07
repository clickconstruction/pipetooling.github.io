#!/usr/bin/env bash
# Runs supabase/tests/gc_schedule against a throwaway copy of the WHOLE schema (v2.4848, the schedule's PR 5).
#
#   npm run test:pg:gc-schedule
#
# The same bed as scripts/pgtest-bid-changes.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The schedule's writes are then applied a
# second time, which must change nothing. The scenario draws, moves, undoes, splits and keeps as a dev
# through RLS, inside one transaction that rolls back: two presses on one version, the refusals in the
# kernels' words, the plan at Start, the records that touch several rows, and the guard. It raises on
# its first failed assertion and ends with "gc_schedule PASSED". PGTEST_KEEP=1 leaves the container
# up. Needs docker; .github/workflows/sql-beds.yml runs it on a PR that touches the schedule's SQL.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55443}"
NAME="pgtest-gc-schedule"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_schedule_writes.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run must change nothing: every function is replaced as it was, and the guard's DO block
# makes no second trigger.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_schedule/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_schedule PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-schedule bed ok"
