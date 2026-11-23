#!/usr/bin/env bash
# Runs supabase/tests/merge_customers against a throwaway copy of the WHOLE schema: merging a customer keeps their GC
# call log and their part on every GC project (v2.5310), and carries every reference to the row that goes (v2.8324).
#
#   npm run test:pg:merge-customers
#
# The same bed as scripts/pgtest-gc-customer-contacts.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The merge's newest migration is then applied a second time, which
# must change nothing. The scenario, inside one transaction that rolls back. Part A: nobody signed out merges, an
# estimator is refused the merge and its preview by role, and an assistant in training mode is stopped at the merge's
# first write (who may merge is the database's rule, assert_caller_can_merge_customer_pair, not the screen's alone); a dev merges a duplicate
# architect into the kept one, and afterwards every line of the duplicate's GC call log reads on the survivor, still naming
# its job; the project the duplicate drew and the one it owned name the survivor; a project with no part for the
# duplicate is untouched; the folds the function already did (projects, the old call log, the chosen address) still
# hold; the duplicate is gone. Part B: an assistant merges a GC typed twice whose other row holds something in every
# kind of place a customer is named, and afterwards nothing names it; what moved, what each rule dropped, closed or
# turned off, and the archive of what was dropped read as laid down; a table the merge never heard of is carried, one
# that lets a customer hold a single row stops the merge by name, and two rows that each hold a legal matter are
# refused. It raises on its first failed assertion and ends with "merge_customers PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR
# that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55475}"
NAME="pgtest-merge-customers"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_merge_customers_every_reference.sql)"

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
# A second run must change nothing: every statement in it is CREATE OR REPLACE, a comment or a grant.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/merge_customers/20_scenario.sql 2>&1 || true)"
if ! grep -q "merge_customers PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "merge-customers bed ok"
