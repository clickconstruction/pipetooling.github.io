#!/usr/bin/env bash
# Runs supabase/tests/primary_scope_reports against a throwaway copy of the WHOLE schema (a primary reads the reports
# of their own jobs and no others, the owner's word of 2026-11-19).
#
#   npm run test:pg:primary-scope-reports
#
# The same bed as scripts/pgtest-primary-paid-verbs.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the scope's two migrations a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: a primary who is the account manager of one job, listed as
# superintendent on a second job's project and named on a third's GC project reads those three jobs' reports, the
# report he wrote himself on a fourth job, the report on the project that lists him and the report on his own bid, and
# no other, through the table, the list functions, the percent reads, the photos and the bucket; a primary on nothing
# reads none; the master, the assistant, the superintendent and the helper read as before. Then the same rule asked
# about a named user (reports_open_to_user, service role only, what the report mailers ask): the same primary reads
# the same reports by name as signed in, a primary on nothing none, everyone else every report. It raises on its first
# failed assertion and ends with "primary_scope_reports PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker;
# the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55643}"
NAME="pgtest-primary-scope-reports"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The scope, then the same rule about a named user, which replaces two of the scope's predicates: always in this order.
SCOPE="$(ls supabase/migrations/*_primary_scope_reports.sql) $(ls supabase/migrations/*_primary_reports_named_user.sql)"

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
# A second run of each must change nothing: CREATE OR REPLACE, DROP POLICY IF EXISTS + CREATE.
for f in $SCOPE; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/primary_scope_reports/20_scenario.sql 2>&1 || true)"
if ! grep -q "primary_scope_reports PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "primary-scope-reports bed ok"
