#!/usr/bin/env bash
# Runs supabase/tests/employment_stints against a throwaway copy of the WHOLE schema (v2.6481: every stretch a person
# worked, kept; migration *_employment_stints).
#
#   npm run test:pg:employment-stints
#
# The same bed as scripts/pgtest-people-phone.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order. Then 10_seed.sql writes a roster as it stood before the migration (the stints trigger off), and the
# migration runs twice more: the first backfills those rows, the second must add nothing. The scenario, inside one
# transaction that rolls back, walks End employment, Bring back, an edit, Ended by mistake, the sub bench's same-day
# Reactivate, first dates, a delete, and the reads through RLS. It raises on its first failed assertion and ends with
# "employment_stints PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55531}"
NAME="pgtest-employment-stints"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_employment_stints.sql)"

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
# The roster as it stood before the migration, then the migration twice: the first backfills, the second adds nothing.
psql_as postgres -f - < supabase/tests/employment_stints/10_seed.sql >/dev/null 2>"$ERR" || { echo "FAILED seeding"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
for _ in 1 2; do
  psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/employment_stints/20_scenario.sql 2>&1 || true)"
if ! grep -q "employment_stints PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "employment-stints bed ok"
