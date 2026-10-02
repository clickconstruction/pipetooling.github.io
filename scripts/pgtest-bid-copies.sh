#!/usr/bin/env bash
# Runs supabase/tests/bid_copies against a throwaway copy of the WHOLE schema (v2.4413).
#
#   npm run test:pg:bid-copies
#
# The same bed as scripts/pgtest-combined-copies.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The scenario makes a new version, a
# duplicate in the same trade and in another, a duplicate of a bid with versions, and an adopt, as
# an estimator and once as a primary, through RLS, inside one transaction that rolls back; it
# raises on its first failed assertion and ends with "bid_copies PASSED". It also re-runs the
# stage-box scenario (combined_copies), since both test the same four functions.
# PGTEST_KEEP=1 leaves the container up. Needs docker. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55437}"
NAME="pgtest-bid-copies"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
MIGRATION="supabase/migrations/20261002130000_bid_copies_carry_costs_prices_one_version.sql"

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
# A second run of the migration must change nothing.
psql_as postgres -f - < "$MIGRATION" >/dev/null 2>&1
for bed in bid_copies combined_copies; do
  out="$(psql_as postgres -f - < "supabase/tests/$bed/20_scenario.sql" 2>&1 || true)"
  if ! grep -q "${bed} PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "bid-copies bed ok"
