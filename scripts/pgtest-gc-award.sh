#!/usr/bin/env bash
# Runs supabase/tests/gc_award against a throwaway copy of the WHOLE schema (v2.4934, the Board's B6-a;
# the award guard, v2.5100).
#
#   npm run test:pg:gc-award
#
# The same bed as scripts/pgtest-bid-changes.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). Award's migration and the award guard's are then
# applied a second time, in that order, which must change nothing (the guard's re-states gc_award with its
# flag). The scenario levels quotes and awards as a dev through RLS, inside one transaction that rolls back:
# the leveled total leveledTotal gives, canAward's refusals, the statement of work sowFromBid draws, the
# contract step, and the award guard's refusals. src/lib/gc/awardSql.test.ts holds the
# kernels to the same numbers and words. It raises on its first failed assertion and ends with
# "gc_award PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; .github/workflows/sql-beds.yml
# runs it on a PR that touches award's SQL.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55444}"
NAME="pgtest-gc-award"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_award_and_sow.sql supabase/migrations/*_gc_award_guard.sql)"

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
# A second run must change nothing: every function is replaced as it was, and each DO block adds no
# second constraint.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/gc_award/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_award PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-award bed ok"
