#!/usr/bin/env bash
# Runs supabase/tests/bid_site_permits against a throwaway copy of the WHOLE schema (v2.8220, punch list #307: the
# read behind a bid's site answers in one order; migration *_bid_site_permits_one_order).
#
#   npm run test:pg:bid-site-permits
#
# The Supabase Postgres image with every file in supabase/migrations applied in order, then this migration a second
# time, which must change nothing. The probe, inside one transaction that rolls back: bid_site_permits answers newest
# first with a permit that has no day last, then by number, type and id, so one permit in both of a city's feeds on
# one day falls the same way on every call; a house number is matched trimmed and lower-cased and asked twice counts
# once; another number, another city and a row with no address key stay out; at the limit of 5,000 rows a tie on the
# last place keeps the twin with the earlier id every time; the office reads the same answer under its own access;
# anon cannot run it. It raises on its first failed assertion and ends with "bid_site_permits PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55907}"
NAME="pgtest-bid-site-permits"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_bid_site_permits_one_order.sql)"

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
# A second run must change nothing: the function is replaced with the body it already has.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/bid_site_permits/20_scenario.sql 2>&1 || true)"
if ! grep -q "bid_site_permits PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "bid-site-permits bed ok"
