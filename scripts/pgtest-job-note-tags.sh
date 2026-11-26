#!/usr/bin/env bash
# Runs supabase/tests/job_note_tags against a throwaway copy of the WHOLE schema (tagging a teammate in a job note,
# punch list #363: the list a note box offers, a note posted with its tags, and what clears a tag).
#
#   npm run test:pg:job-note-tags
#
# The same bed as scripts/pgtest-helper-on-job.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its two migrations a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: the office is offered the crew and the office and no sub, estimator, archived
# person, twin or sample login; a note posts with its tags or not at all; reading and a plain insert clear nothing; an
# answer on the job and No reply needed do; the answer counts for the asker until seen; no client writes a tag row; a
# helper taken off the crew still reads the one note he was tagged in; a note the phone kept and sent late carries
# its tag and answers one, and a press that is not a typed note answers none. It raises on its first
# failed assertion and ends with "job_note_tags PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55797}"
NAME="pgtest-job-note-tags"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# Both migrations, in their order: the second restates two functions of the first.
WRITES="$(ls supabase/migrations/*_jobs_ledger_note_tags.sql) $(ls supabase/migrations/*_job_note_tags_from_the_job_window.sql) $(ls supabase/migrations/*_test_note_delete_dev.sql)"

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
# A second run must change nothing: the table and its indexes left alone, the one policy recreated, the functions
# replaced with the same grants.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/job_note_tags/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "job_note_tags PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "job-note-tags bed ok"
