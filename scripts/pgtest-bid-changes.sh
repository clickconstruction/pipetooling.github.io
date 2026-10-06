#!/usr/bin/env bash
# Runs supabase/tests/bid_changes against a throwaway copy of the WHOLE schema (v2.4598, punch list #73).
#
#   npm run test:pg:bid-changes
#
# The same bed as scripts/pgtest-combined-copies.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). Both bid history migrations are then run a
# second time, which must change nothing. The scenario saves a bid as an estimator through RLS and
# reads the ledger as each role, inside one transaction that rolls back: what each kind of row is
# named, a removed row's children, a cost estimate removed, a copy, a bid deleted, and a save with
# the ledger broken two ways. It raises on its first failed assertion and ends with
# "bid_changes PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55442}"
NAME="pgtest-bid-changes"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
LEDGER="supabase/migrations/20261007040000_bid_changes.sql"
TRIGGERS="supabase/migrations/20261007041000_bid_changes_triggers.sql"
TAG="supabase/migrations/20261007050000_bid_changes_action_tag.sql"

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
# A second run of each must change nothing (and the triggers file must take no lock doing so).
for f in "$LEDGER" "$TRIGGERS" "$TAG"; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/bid_changes/20_scenario.sql 2>&1 || true)"
if ! grep -q "bid_changes PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "bid-changes bed ok"
