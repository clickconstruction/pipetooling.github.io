#!/usr/bin/env bash
# Runs supabase/tests/job_people against a throwaway copy of the WHOLE schema (the job's people, punch list #128
# PR 1: the customer's word on paying opens to the office, the job's account manager and the bid's estimator or
# account manager).
#
#   npm run test:pg:job-people
#
# The same bed as scripts/pgtest-quick-replies-shortcut.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the job-people migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: is_job_people answers true for the office, the job's account
# manager and the bid's estimator or account manager, and false for a stranger, an estimator on another bid, a helper
# on the team and nobody signed in; the estimator writes a promise with heard_by themselves, voids their own and the
# office's on the job, clears the board's date, and reads the job's promises and no other job's; the stranger is
# refused in words on each; the company-wide read still answers NULL to the estimator. It raises on its first failed
# assertion and ends with "job_people PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds
# workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55514}"
NAME="pgtest-job-people"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_job_people.sql)"

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

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# A second run must change nothing: every function is CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/job_people/20_scenario.sql 2>&1 || true)"
if ! grep -q "job_people PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-people bed ok"
