#!/usr/bin/env bash
# Runs supabase/tests/trips against a throwaway copy of the WHOLE schema (a trip record, punch list #379: the four
# tables, who reads them, and the one write door).
#
#   npm run test:pg:trips
#
# The same bed as scripts/pgtest-task-note-tags.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: the four tables carry their fences; the days check takes real days with
# real kinds and nothing else; the office saves a trip whole through trip_save, a dry run first; the office door's
# five roles read every trip, a person on a trip reads that one with its people and its job, and a helper on no
# trip and an estimator read nothing; a person on a trip changes nothing; a training account, a twin and someone
# who left; what the save refuses, in words; a trip replaced whole, deleted with its people and jobs, and made again
# under its own id; Not a trip kept by the office as itself; and a trip going with its site or the job that holds
# it. It raises on its first failed assertion and ends with "trips PASSED". PGTEST_KEEP=1 leaves the container up.
# A second scenario, 30_phone.sql, holds the phone's ground (*_trips_phone): the gate, what the phone is told, start,
# join, day and end on the caller's own row, who is refused, and the stamp trip_save names.
# Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55829}"
NAME="pgtest-trips"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_trips.sql supabase/migrations/*_trips_phone.sql)"

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
# A second run must change nothing: the tables and their indexes left alone, the policies remade, the functions
# replaced with the same grants.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/trips/20_scenario.sql 2>&1 || true)"
if ! grep -q "trips PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
# The phone's ground (*_trips_phone): who may start, join, mark a day and end a trip from a job they are working.
out="$(psql_as postgres -f - < supabase/tests/trips/30_phone.sql 2>&1 || true)"
if ! grep -q "trips phone PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "trips bed ok"
