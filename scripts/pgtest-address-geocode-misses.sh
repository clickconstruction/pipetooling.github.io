#!/usr/bin/env bash
# Runs supabase/tests/address_geocode_misses against a throwaway copy of the WHOLE schema (a place to keep an address
# the map cannot place, punch list #408 step 1).
#
#   npm run test:pg:address-geocode-misses
#
# The Supabase Postgres image with every file in supabase/migrations applied in order. Then the misses migration runs
# twice more and must add nothing. Every scenario in the folder then plays in name order, each inside one transaction
# that rolls back: 10_misses writes and reads a miss as each kind of person (any signed-in role writes, the day is the
# server's, nobody deletes by hand, a training account, a twin, an archived account and anon write none) and saves a
# point, which takes the miss away. A scenario raises on its first failed assertion and ends with a line that says
# PASSED. PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55923}"
NAME="pgtest-address-geocode-misses"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_address_geocode_misses.sql supabase/migrations/*_geocode_miss_delete_dev.sql)"

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
# Each migration twice more, in order: a second and a third run must add nothing.
for _ in 1 2; do
  for w in $WRITES; do
    psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  done
done
for scenario in supabase/tests/address_geocode_misses/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "address_geocode_misses [a-z]* PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  echo "== $scenario"
  grep -o "ok: .*" <<<"$out"
done
echo "address-geocode-misses bed ok"
