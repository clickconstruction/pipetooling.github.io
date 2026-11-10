#!/usr/bin/env bash
# Runs supabase/tests/bid_photos against a throwaway copy of the WHOLE schema (bid photos, punch list #306 PR 1,
# migration *_bid_photos).
#
#   npm run test:pg:bid-photos
#
# The same bed as scripts/pgtest-plan-sets-author.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the bid photos migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: whoever can read a bid reads its photos and adds one as themselves; a primary only on a
# bid of their own; a subcontractor, a superintendent and a primary on no bid read nothing and add nothing; the adder
# and the office change a photo and nobody else does; only an un-added shot of one's own is deleted; a training account
# writes nothing; a twin writes only on its own bid; one Drive file makes one row; and the bucket's objects follow the
# same gate from the path's first folder, with a path that is not a bid's refused and never an error. It raises on its
# first failed assertion and ends with "bid_photos PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55606}"
NAME="pgtest-bid-photos"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
MIGRATION="$(ls supabase/migrations/*_bid_photos.sql)"

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
# A second run must change nothing: the table and indexes are IF NOT EXISTS, the policies dropped and remade by name.
psql_as postgres -f - < "$MIGRATION" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $MIGRATION"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/bid_photos/20_scenario.sql 2>&1 || true)"
if ! grep -q "bid_photos PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "bid-photos bed ok"
