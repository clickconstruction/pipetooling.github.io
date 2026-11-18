#!/usr/bin/env bash
# Runs supabase/tests/job_papers_lock against a throwaway copy of the WHOLE schema (papers before a job opens, step 4:
# the lock in the database for the crew and subs).
#
#   npm run test:pg:job-papers-lock
#
# The same bed as scripts/pgtest-job-required-papers.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: the fence sits on the job's row and on seven tables, restrictive, for
# signed-in users alone; while no job requires a paper a helper, a sub, a superintendent, an estimator, a primary and
# the office reach what they reached before, and the lock never reads a person's papers; a paper on a job closes its
# row, its notes and every helper the crew's access runs through to those who owe it, and closes nothing of another
# job; the office and the primary owe the paper too and keep every read; a locked person cannot write a note on the
# job; the prompt's own read still names the job's number and the paper; signing opens the job to that person alone;
# taking the paper off opens it to everyone. It raises on its first failed assertion and ends with
# "job_papers_lock PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55815}"
NAME="pgtest-job-papers-lock"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_job_papers_lock.sql)"

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
# A second run must change nothing: the eight policies remade, the functions replaced with the same grants.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/job_papers_lock/20_scenario.sql 2>&1 || true)"
if ! grep -q "job_papers_lock PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-papers-lock bed ok"
