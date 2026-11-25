#!/usr/bin/env bash
# Runs supabase/tests/bid_day against a throwaway copy of the WHOLE schema (the bids of the day, punch list #445:
# the beat by bid, the list a person keeps at clock out and the read of a person's own day).
#
#   npm run test:pg:bid-day
#
# The same bed as scripts/pgtest-bid-jobs-opened.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the ground migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: beats add up in a five-minute bucket and stop at its cap; training
# mode, a twin and nobody write none; the beat is read by the person, the owner, a dev and an app activity viewer; a
# day's read holds the person's own changes with the app's writes counted apart; a list is kept, changed, refused for
# an old day and read by whoever reads the person's clock sessions. It raises on its first failed assertion and ends
# with "bid_day PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55935}"
NAME="pgtest-bid-day"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_bid_day_ground.sql)"

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
# A second run must change nothing: IF NOT EXISTS, DROP POLICY IF EXISTS and CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/bid_day/20_scenario.sql 2>&1 || true)"
if ! grep -q "bid_day PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "bid-day bed ok"
