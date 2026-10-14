#!/usr/bin/env bash
# Runs supabase/tests/salary_sync_open_punch against a throwaway copy of the WHOLE schema (v2.5509: the salary sync's
# continuous branch no longer opens the day's template row over a hand punch that already overlaps the window).
#
#   npm run test:pg:salary-sync-open-punch
#
# The same bed as scripts/pgtest-portal-opens-since.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The scenario, inside one transaction
# that rolls back: one salaried user on a continuous 8:00 Chicago day; an early punch left open at the 8:03, noon and
# 16:30 ticks; a punch closed after the start; one ending at the start; a plain day; a late tick's catch-up; an indexed
# split child; a weekend; the function as shipped. It raises on its first failed assertion and ends with
# "salary_sync_open_punch PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it
# from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55524}"
NAME="pgtest-salary-sync-open-punch"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_salary_sync_continuous_open_punch_guard.sql)"

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

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# A second run must change nothing: the function, its comment and its grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/salary_sync_open_punch/20_scenario.sql 2>&1 || true)"
if ! grep -q "salary_sync_open_punch PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "salary-sync-open-punch bed ok"
