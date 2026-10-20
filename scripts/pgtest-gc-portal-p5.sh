#!/usr/bin/env bash
# Runs supabase/tests/gc_portal_p5 against a throwaway copy of the WHOLE schema (P5c-m, the Portal lane).
#
#   npm run test:pg:gc-portal-p5
#
# The same bed as scripts/pgtest-gc-award.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The checks migration is then applied a second
# time, which must change nothing. The scenario writes a company's message of every kind and a ledger row
# of every record type, old and new, refuses an unknown one, and reads both CHECKs validated, inside one
# transaction that rolls back. It raises on its first failed assertion and ends with "gc_portal_p5 PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; .github/workflows/sql-beds.yml runs every bed in
# scripts/sql-beds.txt on any migration change.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55447}"
NAME="pgtest-gc-portal-p5"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_portal_p5_checks.sql)"

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
# A second run must change nothing: the function is replaced as it was, and its grants come out the same.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_portal_p5/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_portal_p5 PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-portal-p5 bed ok"
