#!/usr/bin/env bash
# Runs supabase/tests/task_doer_acts against a throwaway copy of the WHOLE schema (v2.7542, punch list #369 step C1:
# what the person doing a task may do with it; migration *_task_doer_acts).
#
#   npm run test:pg:task-doer-acts
#
# The same bed as scripts/pgtest-painted-maps.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The scenario, inside one transaction
# that rolls back: the thread's check holds its twelve kinds and there is one such check; the four acts are for a
# signed-in account, closed to anon, and run as their owner, and their gate is called only from inside them; a person
# on a task writes a stuck line and its answer as themself and may not write a moved or a dropped line by hand; the
# person doing a one-time task moves its due day, today or later and within a year, the change logged with who and the
# day row left where it was, and a repeating task or a done one is not moved; a training account, a twin, someone who
# left and someone not on the task do none of the four; a one-time task is closed with a reason, completed and then
# dropped in its thread, and a repeating task, a roadmap task and a vehicle task are refused with the roadmap task and
# the service left open; a task is handed to a person who can sign in and to nobody else, a one-time task whole and a
# repeating one for that day alone, a roadmap task not at all, and the office hands on for someone else; a map the
# caller painted, with a line on it, lands on a task that has none, on the roadmap task when there is one, and never
# swaps a map that is there. It raises on its first failed assertion and ends with "task_doer_acts PASSED".
# A second scenario, 20_skipped.sql (v2.7551, step D3, migration *_task_skipped_line), holds the skipped line: one more
# kind in the same check, written like a note by whoever reads the day row, as themself, with the row left not done and
# the functions' own kinds still closed to a hand; it ends with "task_skipped_line PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a
# ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55637}"
NAME="pgtest-task-doer-acts"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_task_doer_acts.sql supabase/migrations/*_task_skipped_line.sql)"

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
# A second run must change nothing: the check is dropped and added back the same, the policy and the functions remade.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/task_doer_acts/10_acts.sql 2>&1 || true)"
if ! grep -q "task_doer_acts PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/task_doer_acts/20_skipped.sql 2>&1 || true)"
if ! grep -q "task_skipped_line PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "task-doer-acts bed ok"
