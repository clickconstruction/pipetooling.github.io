#!/usr/bin/env bash
# Runs supabase/tests/gc_start against a throwaway copy of the WHOLE schema (v2.5045, the Board's B6-c-i: Start and
# Start anyway).
#
#   npm run test:pg:gc-start
#
# The same bed as scripts/pgtest-gc-award.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). gc_start_project's migration is then applied a second time, which must change
# nothing. The scenario, inside one transaction that rolls back: who may start a job, each refusal in words, Start,
# Start anyway with what was missing, and the schedule's baseline on the day of Start.
# src/lib/gc/startSql.test.ts holds every refusal it asserts to the plain-words rules. It raises on its first failed
# assertion and ends with "gc_start PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker;
# .github/workflows/sql-beds.yml runs it on a PR that touches Start's SQL.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55449}"
NAME="pgtest-gc-start"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_start_project.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run must change nothing: the function is replaced as it was, with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_start/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_start PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-start bed ok"
