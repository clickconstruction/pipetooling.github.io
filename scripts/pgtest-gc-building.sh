#!/usr/bin/env bash
# Runs supabase/tests/gc_building against a throwaway copy of the WHOLE schema (v2.4957, the Building
# lane's U3a-i; every Building press since).
#
#   npm run test:pg:gc-building
#
# The same bed as scripts/pgtest-gc-schedule.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). Building's presses (PRESSES below) are then
# applied a second time, which must change nothing. Each file in supabase/tests/gc_building plays one
# press's scenario through RLS as a dev, a trainee, a twin and a role outside Building's dev door, inside
# one transaction that rolls back. Each raises on its first failed assertion and ends with
# "gc_building PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; .github/workflows/sql-beds.yml
# runs it on a PR that touches Building's SQL. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55444}"
NAME="pgtest-gc-building"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# Building's presses, each applied a second time below. A new press adds its file here, its scenario
# under supabase/tests/gc_building and its pattern to sql-beds.yml's paths.
PRESSES=(
  supabase/migrations/*_gc_save_daily_log.sql
  supabase/migrations/*_gc_submittal_writes.sql
  supabase/migrations/*_gc_rfi_writes.sql
  supabase/migrations/*_gc_trade_draws.sql
)

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
# The registry rate-limits a burst of pulls (every bed in sql-beds.yml pulls this image at once), so a
# refused pull waits and tries again before the bed gives up.
for i in 1 2 3 4 5; do docker pull -q "$IMAGE" >/dev/null 2>&1 && break; [ "$i" = 5 ] && { echo "could not pull $IMAGE"; exit 1; }; sleep $((i * 15)); done
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run must change nothing: each press's functions are replaced as they were.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
for scenario in supabase/tests/gc_building/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "gc_building PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "gc-building bed ok"
