#!/usr/bin/env bash
# Runs supabase/tests/write_down_first_amount against a throwaway copy of the WHOLE schema (a bill written down more
# than once keeps the amount before its first write-down, punch list #85).
#
#   npm run test:pg:write-down-first-amount
#
# The same bed as scripts/pgtest-primary-money-verbs.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the write-down's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: the assistant writes an in-app bill down three times and the
# Stripe writer, called as the service role, does the same to a Stripe bill; after each the bill's kept amount is the
# amount before the first. A fee that takes a written-down bill above its kept amount moves the kept amount up, on
# each writer. It raises on its first failed assertion and ends with "write_down_first_amount PASSED". PGTEST_KEEP=1
# leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that
# touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55909}"
NAME="pgtest-write-down-first-amount"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_write_down_keeps_first_amount.sql)"

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
# A second run must change nothing: CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/write_down_first_amount/20_scenario.sql 2>&1 || true)"
if ! grep -q "write_down_first_amount PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "write-down-first-amount bed ok"
