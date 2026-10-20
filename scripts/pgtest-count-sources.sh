#!/usr/bin/env bash
# Runs supabase/tests/count_sources against a throwaway copy of the WHOLE schema (combine two CountTooling counts on
# one bid, v2.5517: bid_count_sources and bids_count_rows.source_shares).
#
#   npm run test:pg:count-sources
#
# The same bed as scripts/pgtest-portal-opens-since.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then this migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: the bid's estimator registers two projects and stamps shares, the office
# reads them, a superintendent outside the bid reads none, a second source with the same token and an array of shares
# are refused. It raises on its first failed assertion and ends with "count_sources PASSED". PGTEST_KEEP=1 leaves the
# container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a
# migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55521}"
NAME="pgtest-count-sources"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_bid_count_sources.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
. scripts/pgtest-pull.sh
pgtest_pull_supabase "$IMAGE"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"
trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1; rm -f "$ERR"' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# A second run must change nothing: the table, the column, the policies, the constraint.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/count_sources/20_scenario.sql 2>&1 || true)"
if ! grep -q "count_sources PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "count-sources bed ok"
