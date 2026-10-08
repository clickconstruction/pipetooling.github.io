#!/usr/bin/env bash
# Runs supabase/tests/gc_building against a throwaway copy of the WHOLE schema (v2.4957, the Building
# lane's U3a-i).
#
#   npm run test:pg:gc-building
#
# The same bed as scripts/pgtest-gc-schedule.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The daily log's press is then applied a second
# time, which must change nothing. The scenario saves, replaces, catches up and refuses as a dev, a
# trainee, a twin and an estimator through RLS, inside one transaction that rolls back. It raises on its
# first failed assertion and ends with "gc_building PASSED". PGTEST_KEEP=1 leaves the container up.
# Needs docker; .github/workflows/sql-beds.yml runs it on a PR that touches Building's SQL. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55444}"
NAME="pgtest-gc-building"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
PRESS="$(ls supabase/migrations/*_gc_save_daily_log.sql)"

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
# A second run must change nothing: the function is replaced as it was.
psql_as postgres -f - < "$PRESS" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $PRESS"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_building/20_daily_log.sql 2>&1 || true)"
if ! grep -q "gc_building PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-building bed ok"
