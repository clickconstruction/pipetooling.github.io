#!/usr/bin/env bash
# Runs supabase/tests/combined_copies against a throwaway copy of the WHOLE schema (v2.4388).
#
#   npm run test:pg:combined-copies
#
# The copy functions touch a dozen tables behind RLS, so the bed is not a stand-in: it is the
# Supabase Postgres image with every file in supabase/migrations applied in order (about a
# minute). Two things prod has that the migrations do not make are added first: the pg_cron and
# pg_net extensions, and the storage API's two tables. The scenario runs as an estimator inside
# one transaction that rolls back, raises on its first failed assertion and ends with
# "combined_copies PASSED". PGTEST_KEEP=1 leaves the container up for a second look.
# Needs docker. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55435}"
NAME="pgtest-combined-copies"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
BED="supabase/tests/combined_copies"
MIGRATION="supabase/migrations/20261002100000_combined_copies_keep_stages.sql"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < "$BED/00_prod_extras.sql" >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run of the migration must change nothing.
psql_as postgres -f - < "$MIGRATION" >/dev/null 2>&1
out="$(psql_as postgres -f - < "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "combined_copies PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "combined-copies bed ok"
