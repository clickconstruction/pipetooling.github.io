#!/usr/bin/env bash
# Runs supabase/tests/dev_seat_kept_plans against a throwaway copy of the WHOLE schema (v2.7122, punch list #315:
# one approvals list, a plan the dev seat made on a person's HR file kept for a yes).
#
#   npm run test:pg:dev-seat-kept-plans
#
# The same bed as scripts/pgtest-person-engagements.sh: the Supabase Postgres image migrated through pgtest_migrate
# (every file in supabase/migrations in order, or in CI the leg's migrated copy), then the kept plans' migration a
# second time, which must change nothing. The scenario plays the two doors through RLS as a dev and as an estimator,
# inside one transaction that rolls back: keep stores a plan for the person its arguments write to; a verb off the
# list, a file's bytes, counsel-only material, another person's file and the same plan twice are refused; a plan is
# decided once and is what it was when kept; nobody writes the table directly. It raises on its first failed
# assertion and ends with "dev_seat_kept_plans PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55617}"
NAME="pgtest-dev-seat-kept-plans"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The kept plans' migration, applied a second time below.
PRESSES=(
  supabase/migrations/*_dev_seat_kept_plans.sql
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
for scenario in supabase/tests/dev_seat_kept_plans/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "dev_seat_kept_plans PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "dev-seat-kept-plans bed ok"
