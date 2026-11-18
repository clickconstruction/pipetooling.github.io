#!/usr/bin/env bash
# Runs supabase/tests/job_finish_calls against a throwaway copy of the WHOLE schema (the pace card's My finish date,
# punch list #396 PR 3a: the job_finish_calls table).
#
#   npm run test:pg:job-finish-calls
#
# The same bed as scripts/pgtest-dashboard-view.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the table's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: the table carries its fences and its two policies, a job's
# master says a day and another, a row in another person's name and a why with no words are refused, nobody changes
# or deletes a saying, the crew and an estimator say a day exactly when jobs_ledger lets them read the job, and a
# training account, a twin and a person who left are refused on a job of their own. It raises on its first failed
# assertion and ends with "job_finish_calls PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55849}"
NAME="pgtest-job-finish-calls"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_job_finish_calls.sql)"

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
# A second run must change nothing: IF NOT EXISTS, and the policies dropped and made again.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/job_finish_calls/20_scenario.sql 2>&1 || true)"
if ! grep -q "job_finish_calls PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-finish-calls bed ok"
