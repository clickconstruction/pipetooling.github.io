#!/usr/bin/env bash
# Runs supabase/tests/job_warranty against a throwaway copy of the WHOLE schema (the warranty in place of a contract, the
# owner's call of 2026-11-02).
#
#   npm run test:pg:job-warranty
#
# The same bed as scripts/pgtest-residential-flow.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the warranty migration once more, last, which must change nothing. The scenario, inside one
# transaction that rolls back: a job_contracts row from before the column is a contract; a kind the app does not know
# and initials that are not a list are refused; one live agreement per job holds across the kinds; the job's feed says
# Warranty where it said Contract; warranty_signed and the warranty paper sit where facts.ts puts them and a step may
# pick them; the residential flow has the Warranty step aside at the end of its lane as seed.ts draws it; the migration
# once more mid-scenario (at its -- @rerun line, as a second push would) adds no second step and leaves an office edit
# alone; and a flow seeded afresh has twelve steps. It raises on its first failed assertion and ends with "job_warranty
# PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt
# on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55533}"
NAME="pgtest-job-warranty"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
FIX="$(ls supabase/migrations/*_job_warranty.sql)"
SCENARIO="supabase/tests/job_warranty/20_scenario.sql"

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
if ! grep -q "job_warranty PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-warranty bed ok"
