#!/usr/bin/env bash
# Runs supabase/tests/calling_lock_takeover against a throwaway copy of the WHOLE schema (quirk 38 of
# docs/PROSPECTS_TABS_ARCHITECTURE.md; migration *_calling_lock_stale_takeover).
#
#   npm run test:pg:calling-lock-takeover
#
# The same bed as scripts/pgtest-archived-seal.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order. Then one transaction that rolls back: 10_seed.sql writes two callers' worth of locks (stale, with
# no time, live), the migration runs a second time over them, and 20_scenario.sql reads what it left and tries the
# locks as signed-in callers. The second run must keep the one policy and delete only the stale rows. The tries: a
# second caller's upsert takes a row past the 30 minutes and a row with no time, and is refused on a live row; nobody
# writes a row in another caller's name; the old holder cannot take a live row back; delete is still your own row
# only; an archived caller, a read-only caller and a signed-out one take nothing. It raises on its first failed
# assertion and ends with "calling_lock_takeover PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55852}"
NAME="pgtest-calling-lock-takeover"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_calling_lock_stale_takeover.sql)"

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
# The seed opens the transaction, the migration runs a second time inside it, the scenario reads the result and rolls back.
out="$(cat supabase/tests/calling_lock_takeover/10_seed.sql "$WRITES" supabase/tests/calling_lock_takeover/20_scenario.sql | psql_as postgres -f - 2>&1 || true)"
if ! grep -q "calling_lock_takeover PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "calling-lock-takeover bed ok"
