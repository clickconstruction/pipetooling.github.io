#!/usr/bin/env bash
# Runs supabase/tests/person_file_numbers against a throwaway copy of the WHOLE schema (v2.6971, punch list #315:
# exhibit numbers, a case's open items and its log, numbered by the database).
#
#   npm run test:pg:person-file-numbers
#
# The same bed as scripts/pgtest-theme-review.sh: the Supabase Postgres image migrated through pgtest_migrate (every
# file in supabase/migrations in order, or in CI the leg's migrated copy), then the numbers' migration a second time,
# which must change nothing. The scenario plays the three doors through RLS as a dev and as an estimator, inside one
# transaction that rolls back: a new record takes the file's next number whatever the client sends; the backfill
# numbers what is clear and reports a clash, a lettered number and a title with none without guessing; dev_case_write
# numbers a new item, carries one over, refuses a taken number, logs every change and answers a dry run that moves
# when another session adds an item first. It raises on its first failed assertion and ends with
# "person_file_numbers PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it
# from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55615}"
NAME="pgtest-person-file-numbers"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The numbers' migration, applied a second time below.
PRESSES=(
  supabase/migrations/*_person_file_numbers.sql
)

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
# A second run must change nothing: the table, its policies and the functions are all made idempotent.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/person_file_numbers/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "person_file_numbers PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "person-file-numbers bed ok"
