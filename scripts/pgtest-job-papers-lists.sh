#!/usr/bin/env bash
# Runs supabase/tests/job_papers_lists against a throwaway copy of the WHOLE schema (papers before a job opens, step 5:
# the lists and the functions that never ask row security).
#
#   npm run test:pg:job-papers-lists
#
# The same bed as scripts/pgtest-job-papers-lock.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: before any paper the job search, the assigned jobs, the tally jobs and the
# schedule email's read answer as they did; a paper on a job leaves a locked helper its number alone in each, and the
# job no longer answers a search by its name or its address; the office and the primary, who owe the paper too, still
# find it by name; the lock's question about a named user answers as the lock's own question does for every role; the
# schedule email's read and the shared schedule keep a block's number and blank the rest for a locked recipient;
# signed, every list names the job again. It raises on its first failed assertion and ends with
# "job_papers_lists PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55816}"
NAME="pgtest-job-papers-lists"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_job_papers_lists.sql)"

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
# A second run must change nothing: nine functions replaced with the same grants.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/job_papers_lists/20_scenario.sql 2>&1 || true)"
if ! grep -q "job_papers_lists PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-papers-lists bed ok"
