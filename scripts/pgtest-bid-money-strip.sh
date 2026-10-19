#!/usr/bin/env bash
# Runs supabase/tests/bid_money_strip against a throwaway copy of the WHOLE schema (the money line under a won bid,
# punch list #129 PR 2: list_bid_money_strip, the job's people's read of where the job born of a bid stands on money).
#
#   npm run test:pg:bid-money-strip
#
# The same bed as scripts/pgtest-job-people.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the strip migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: the bid's estimator gets the newest job of their bid with its bills, payments and live
# promises in the shapes the client's kernels take, and nothing for another's bid or a bid with no job; the office gets
# every bid's; a helper on the job's team and nobody signed in get nothing. It raises on its first failed assertion and
# ends with "bid_money_strip PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs
# it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55515}"
NAME="pgtest-bid-money-strip"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_bid_money_strip.sql)"

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
# A second run must change nothing: CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/bid_money_strip/20_scenario.sql 2>&1 || true)"
if ! grep -q "bid_money_strip PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "bid-money-strip bed ok"
