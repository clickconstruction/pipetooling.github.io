#!/usr/bin/env bash
# Runs supabase/tests/merge_customers against a throwaway copy of the WHOLE schema: merging a customer keeps their GC
# call log and their part on every GC project (v2.5310).
#
#   npm run test:pg:merge-customers
#
# The same bed as scripts/pgtest-gc-customer-contacts.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The merge's migration is then applied a second time, which must
# change nothing. The scenario, inside one transaction that rolls back: nobody signed out merges; a dev merges a duplicate
# architect into the kept one, and afterwards every line of the duplicate's GC call log reads on the survivor, still naming
# its job; the project the duplicate drew and the one it owned name the survivor; a project with no part for the
# duplicate is untouched; the folds the function already did (projects, the old call log, the chosen address) still
# hold; the duplicate is gone. It raises on its first failed assertion and ends with "merge_customers PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR
# that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55475}"
NAME="pgtest-merge-customers"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_merge_customers_gc_folds.sql)"

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
# A second run must change nothing: CREATE OR REPLACE of the one function.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/merge_customers/20_scenario.sql 2>&1 || true)"
if ! grep -q "merge_customers PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "merge-customers bed ok"
