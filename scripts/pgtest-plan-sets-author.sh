#!/usr/bin/env bash
# Runs supabase/tests/plan_sets_author against a throwaway copy of the WHOLE schema (plan sets by part, punch list
# #239: an as-built's author stays on the job, migration *_plan_sets_author_stays_on_job).
#
#   npm run test:pg:plan-sets-author
#
# The same bed as scripts/pgtest-job-people.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the author migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: a subcontractor on a job's crew keeps an as-built on it and changes its memo; moving the
# row to a job they are not on, or to another part, is refused as a row-level violation; put on the other job's crew,
# the move passes; a new as-built on a job they are not on is refused; the office moves any row; a helper on the crew
# keeps an as-built too, since the predicate no longer hangs on their team-members visibility. It raises on its first
# failed assertion and ends with "plan_sets_author PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55598}"
NAME="pgtest-plan-sets-author"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_plan_sets_author_stays_on_job.sql)"

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
# A second run must change nothing: the function is CREATE OR REPLACE, the policies dropped and remade by name.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/plan_sets_author/20_scenario.sql 2>&1 || true)"
if ! grep -q "plan_sets_author PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "plan-sets-author bed ok"
