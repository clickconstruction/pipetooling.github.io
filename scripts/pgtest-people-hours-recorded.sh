#!/usr/bin/env bash
# Runs supabase/tests/people_hours_recorded against a throwaway copy of the WHOLE schema (recorded time finds a
# person's pay row by its key, punch list #430, migration *_people_hours_recorded_pay_join_by_key).
#
#   npm run test:pg:people-hours-recorded
#
# The same bed as scripts/pgtest-bid-photos.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the view's migration a second time, which must change nothing (the view replaced by itself).
# The scenario, inside one transaction that rolls back: every side of the view's full join, with a pay row and without
# one, reads as it should; a dev, the assistant, a pay-approved master and a crew member reading their own time each
# read the same rows from the view and from the view as it stood, rebuilt from the live definition with the COALESCE
# back; and the plan finds the pay row by its key where the view before did not. It raises on its first failed
# assertion and ends with "people_hours_recorded PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55911}"
NAME="pgtest-people-hours-recorded"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
VIEW="$(ls supabase/migrations/*_people_hours_recorded_pay_join_by_key.sql)"

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
# A second run must change nothing: CREATE OR REPLACE VIEW with the same columns in the same order.
psql_as postgres -f - < "$VIEW" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $VIEW"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/people_hours_recorded/20_scenario.sql 2>&1 || true)"
if ! grep -q "people_hours_recorded PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "people-hours-recorded bed ok"
