#!/usr/bin/env bash
# Runs supabase/tests/task_note_tags against a throwaway copy of the WHOLE schema (tagging a teammate in a task note,
# punch list #375: the list a task's note box offers, a note posted with its tags, and what answers a tag).
#
#   npm run test:pg:task-note-tags
#
# The same bed as scripts/pgtest-job-note-tags.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: a person on a task is offered whoever gave it and the office, and no sub,
# estimator, training account, archived person, twin or sample login, nor a primary or a helper who does not have the
# task; a note posts with its tags or not at all; no client writes a tag row; a stuck line, a tick and a handed line
# answer nothing; a typed note does, inserted the way the note box inserts it, on any day of the same task and on no
# other task; No reply needed clears one; the answer counts for the asker until seen; a tag on a done task reopens
# nothing; a tag goes with a task handed on and its person still reads that one note; a day of a repeating task given
# away is no longer that person's to be tagged on; job tags and task tags come back in one read with one count, with
# who has left; and deleting the task takes its tags. It raises on its first failed assertion and ends with
# "task_note_tags PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55813}"
NAME="pgtest-task-note-tags"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_task_note_tags.sql supabase/migrations/*_test_note_delete_dev.sql)"

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
# A second run must change nothing: the table and its indexes left alone, the one policy and the one trigger remade,
# the functions replaced with the same grants.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/task_note_tags/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "task_note_tags PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "task-note-tags bed ok"
