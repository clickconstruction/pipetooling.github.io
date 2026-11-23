#!/usr/bin/env bash
# Runs supabase/tests/working_hours against a throwaway copy of the WHOLE schema (working hours: a week with a start
# and an end for each day, set by a dev or the controller; migration *_working_hours_door).
#
#   npm run test:pg:working-hours
#
# The same bed as scripts/pgtest-salaried-week.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order. Then the migration runs twice more, and must add nothing. The scenario, inside one transaction
# that rolls back, tries the shapes a week may and may not take, signs in as each role at the door, sets the helper's
# week with pay standing still, moves a salaried day's length with the seven numbers and the pay log following, and
# writes to the table itself as a signed-in person. It raises on its first failed assertion and ends with
# "working_hours door PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it
# from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55861}"
NAME="pgtest-working-hours"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_working_hours_door.sql)"

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
# The migration twice more: a second and a third run must add nothing.
for _ in 1 2; do
  for w in $WRITES; do
    psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  done
done
out="$(psql_as postgres -f - < supabase/tests/working_hours/10_door.sql 2>&1 || true)"
if ! grep -q "working_hours door PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "working-hours bed ok"
