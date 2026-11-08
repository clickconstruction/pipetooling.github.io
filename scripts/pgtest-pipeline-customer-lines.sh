#!/usr/bin/env bash
# Runs supabase/tests/pipeline_customer_lines against a throwaway copy of the WHOLE schema (punch list #125, PR 1: the
# Pipeline board's read of the customer's conversation, pipeline_customer_lines).
#
#   npm run test:pg:pipeline-customer-lines
#
# The same bed as scripts/pgtest-portal-customer-lines.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The migration is then applied a second time, which must change
# nothing. The scenario, inside one transaction that rolls back: the office reads each job's newest three calls, texts
# and emails under Job activity's rule and the sheet's (the lines tied to the job, the customer's untied lines since it
# began while it is unpaid, never a note or an event), a paid job drops the untied ones, a trade's untied call stays with
# the trade, the count is held to 1..10, a nameless contact reads its customer's name, two jobs in one call keep apart,
# and a tech reads nothing. It raises on its first failed assertion and ends with "pipeline_customer_lines PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR
# that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55512}"
NAME="pgtest-pipeline-customer-lines"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_pipeline_customer_lines.sql)"

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
# A second run must change nothing: the function and the index are as before.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/pipeline_customer_lines/20_scenario.sql 2>&1 || true)"
if ! grep -q "pipeline_customer_lines PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "pipeline-customer-lines bed ok"
