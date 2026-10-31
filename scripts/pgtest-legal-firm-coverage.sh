#!/usr/bin/env bash
# Runs supabase/tests/legal_firm_coverage against a throwaway copy of the WHOLE schema (Firms and their coverage,
# punch list #222: v2.6227's shared counties with one first call and legal_save_county_coverage, and each later
# PR's file beside it).
#
#   npm run test:pg:legal-firm-coverage
#
# The same bed as scripts/pgtest-robot-fixtures.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then each #222 migration a second time, which must change nothing. Every
# file in supabase/tests/legal_firm_coverage runs in order inside its own rolled-back transaction, raises on its
# first failed assertion, and ends with a line holding "PASSED". PGTEST_KEEP=1 leaves the container up. Needs
# docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55534}"
NAME="pgtest-legal-firm-coverage"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
. scripts/pgtest-pull.sh
pgtest_pull_supabase "$IMAGE"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"
trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1; rm -f "$ERR"' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# A second run of each #222 migration must change nothing.
for f in supabase/migrations/*_legal_firm_shared_counties.sql supabase/migrations/*_legal_hand_off_counties.sql; do
  [ -e "$f" ] || continue
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for t in supabase/tests/legal_firm_coverage/[0-9]*.sql; do
  out="$(psql_as postgres -f - < "$t" 2>&1 || true)"
  if ! grep -q "PASSED" <<<"$out"; then echo "FAILED $t"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "legal-firm-coverage bed ok"
