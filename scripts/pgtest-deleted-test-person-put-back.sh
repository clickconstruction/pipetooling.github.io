#!/usr/bin/env bash
# Runs supabase/tests/deleted_test_person_put_back against a throwaway copy of the WHOLE schema (punch list #443,
# row 12: a deleted test person can be put back).
#
#   npm run test:pg:deleted-test-person-put-back
#
# The same bed as scripts/pgtest-lien-notice-record-delete.sh: the Supabase Postgres image migrated through
# pgtest_migrate (every file in supabase/migrations in order, or in CI the leg's migrated copy), then the row's
# migration a second time, which must change nothing. The scenario plays delete_fresh_person and
# restore_deleted_test_person as the signed-in person, inside one transaction that rolls back: a dev deletes a ZZ-named
# person made with add_worker, with a pay row and a workday template, and the dry run and the delete both answer
# copy_kept; Deleted records then holds the users row and the template beside the People record, under the record's
# id; an assistant, nobody signed in, a blank key and a key nobody holds are refused; the preview answers the four
# counts and leaves nothing behind; the put-back returns the four rows as they were, with the employment stint and one
# line on the pay log, and a second call finds no copy; the person is deleted and put back a second time; a person
# whose name does not start with ZZ is deleted as before, with no users copy, and neither door puts him back; a
# person on the roster already, an email another holds, a pay row under the name, a People record that stands, a copy
# whose name does not start with ZZ and a copy with no id are each refused in their own sentence; a person is a test
# person by the card's name alone; a workday that named a job and a bid which are gone comes back without them. It
# raises on its first failed assertion and ends with "deleted_test_person_put_back PASSED". PGTEST_KEEP=1 leaves the
# container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a
# migration. Never touches prod.
#
# The older bed users-without-login also plays delete_fresh_person, over stand-in tables and a list of migrations of
# its own that stops before this one. It holds no archive, no archive trigger and no stint trigger, which is what this
# row is about, so the row has a whole-schema bed of its own.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55712}"
NAME="pgtest-deleted-test-person-put-back"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_deleted_test_person_put_back.sql)"

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
# A second run must change nothing: both functions are CREATE OR REPLACE.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/deleted_test_person_put_back/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "deleted_test_person_put_back PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "deleted-test-person-put-back bed ok"
