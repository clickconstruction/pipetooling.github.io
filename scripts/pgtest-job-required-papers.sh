#!/usr/bin/env bash
# Runs supabase/tests/job_required_papers against a throwaway copy of the WHOLE schema (papers before a job opens,
# step 1: the papers a job requires, a person's signed copy tied to that job, and the one question every lock asks).
#
#   npm run test:pg:job-required-papers
#
# The same bed as scripts/pgtest-task-note-tags.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: while no job requires a paper the lock question answers open for everyone
# and reads the required papers alone, never a paper or a person; only the office requires a paper, only through the
# function, only one with words; a job with papers is closed to every login, the office too, and open to the service
# key; a job with none stays open and asking about it still reads no paper and no person; a person's copy is made once
# from the job's words and named with the job's number, never for someone else unless the office or the service key
# asks, never with no roster person tied to the login, never in training mode; one signature leaves the job closed and
# the last one opens it, to that person alone; a Contract Book save mints nothing for a job's copy; the roster lists
# the office, the crew, the subs and anyone else holding a copy; taking a paper off opens the job and keeps the
# signatures, the same words put back bring them back, and new words ask for new signatures. It raises on its first
# failed assertion and ends with "job_required_papers PASSED".
#
# A second scenario, 30_removed_paper_delete.sql (punch list #443, row 10, migration *_test_job_removed_paper_delete,
# which also runs a second time here): on a job named ZZ a dev requires three papers and takes them off, the list
# answers the three, newest taken off first, a delete answers ok and the row is gone; a paper a person's copy names,
# a GC proposal was made on or taken as, or a later revision names is refused in its own sentence and stays, with its
# count in the list; nobody signed in, the office, a helper, a paper that is not there, a paper still on its job and a
# taken-off paper of a job not named ZZ are refused, each in its own sentence; and a direct DELETE as the dev still
# reaches no row. It ends with "removed_paper_delete PASSED".
#
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a
# ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55848}"
NAME="pgtest-job-required-papers"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_job_required_papers.sql)"

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
# A second run must change nothing: the table, its indexes and the two columns left alone, the one policy remade, the
# functions replaced with the same grants.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# The job settings migration (#389 step 3) replaced job_papers_require with one that takes a third name, and dropped
# the old one. The file above makes the old one again, so the newer file runs after it, as on prod.
LATER="$(ls supabase/migrations/*_settings_on_the_job.sql)"
psql_as postgres -f - < "$LATER" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $LATER"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
# And the ground under #389's step 4, which replaces job_papers_require once more.
GROUND="$(ls supabase/migrations/*_settings_page_ground.sql)"
psql_as postgres -f - < "$GROUND" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $GROUND"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
# The developer's delete of a test job's taken-off paper (punch list #443, row 10): two functions, replaced with the
# same grants.
TAKEBACK="$(ls supabase/migrations/*_test_job_removed_paper_delete.sql)"
psql_as postgres -f - < "$TAKEBACK" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $TAKEBACK"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/job_required_papers/20_scenario.sql 2>&1 || true)"
if ! grep -q "job_required_papers PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/job_required_papers/30_removed_paper_delete.sql 2>&1 || true)"
if ! grep -q "removed_paper_delete PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-required-papers bed ok"
