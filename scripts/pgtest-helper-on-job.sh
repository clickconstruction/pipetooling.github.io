#!/usr/bin/env bash
# Runs supabase/tests/helper_on_job against a throwaway copy of the WHOLE schema (a helper on a job's crew leaves and
# reads its thread notes: helper_on_job and the thread notes' field branch that asks it).
#
#   npm run test:pg:helper-on-job
#
# The same bed as scripts/pgtest-messages-tech-send.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then this migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: a helper on the crew alone, who sees no crew row of their own, leaves a note
# and reads it with the office's; a helper on no job does neither; a sub dispatched three weeks ago keeps what the
# branch's own dispatch check gave; the office reads both; nobody signed out asks helper_on_job. It raises on its first
# failed assertion and ends with "helper_on_job PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55531}"
NAME="pgtest-helper-on-job"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_helper_on_job_thread_notes.sql)"

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
# A second run must change nothing: the function with the same grants, the two policies recreated.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/helper_on_job/20_scenario.sql 2>&1 || true)"
if ! grep -q "helper_on_job PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "helper-on-job bed ok"
