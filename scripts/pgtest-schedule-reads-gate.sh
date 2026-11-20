#!/usr/bin/env bash
# Runs supabase/tests/schedule_reads_gate against a throwaway copy of the WHOLE schema (the schedule emails' two reads
# ask who is calling).
#
#   npm run test:pg:schedule-reads-gate
#
# The same bed as scripts/pgtest-job-papers-lists.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the gate's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: a helper on no job reads his own empty day and is refused when he
# names anyone else on either read; a scheduled helper, a superintendent and a primary each read for themselves what
# they read before; the office previews the day email of the person it picks and reads the shared schedule for itself
# alone; the service role with no login reads both for anyone; a caller with no login and no service key is refused.
# It raises on its first failed assertion and ends with "schedule_reads_gate PASSED". PGTEST_KEEP=1 leaves the
# container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a
# migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55852}"
NAME="pgtest-schedule-reads-gate"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_schedule_reads_ask_who_calls.sql)"

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
# A second run must change nothing: CREATE OR REPLACE, and grants that name every role.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/schedule_reads_gate/20_scenario.sql 2>&1 || true)"
if ! grep -q "schedule_reads_gate PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "schedule-reads-gate bed ok"
