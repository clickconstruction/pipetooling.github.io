#!/usr/bin/env bash
# Runs supabase/tests/portal_customer_lines against a throwaway copy of the WHOLE schema (Messages, cut 8a: the lines
# the office types for a customer's page, each with its Spanish, and who is on site).
#
#   npm run test:pg:portal-customer-lines
#
# The same bed as scripts/pgtest-gc-customer-contacts.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The cut 8a migration is then applied a second time, which must
# change nothing. The scenario, inside one transaction that rolls back: the daily log saves This week's line with its
# Spanish, keeps it when a page sends none, clears the old Spanish beside a new English line and refuses Spanish alone;
# the money team writes what a pay application covers through its own column grant and nothing else of a sent bill; a
# change order takes its Spanish; the office names the job's superintendent, and a removed user leaves it empty; a
# line is never only spaces and Spanish never stands without English. It raises on its first failed assertion and
# ends with "portal_customer_lines PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow
# runs it from scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55482}"
NAME="pgtest-portal-customer-lines"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_portal_customer_lines.sql)"

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
# A second run must change nothing: the columns, their checks, the grant and the daily log's save are as before.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/portal_customer_lines/20_scenario.sql 2>&1 || true)"
if ! grep -q "portal_customer_lines PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "portal-customer-lines bed ok"
