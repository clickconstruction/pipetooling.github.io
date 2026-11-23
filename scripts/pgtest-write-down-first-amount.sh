#!/usr/bin/env bash
# Runs supabase/tests/write_down_first_amount against a throwaway copy of the WHOLE schema (a bill written down more
# than once keeps the amount before its first write-down, and every write-down is a line on the job's activity, punch
# list #85).
#
#   npm run test:pg:write-down-first-amount
#
# The same bed as scripts/pgtest-primary-money-verbs.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the write-down's two migrations a second time, which must change nothing.
# The first scenario, inside one transaction that rolls back: the assistant writes an in-app bill down three times and
# the Stripe writer, called as the service role, does the same to a Stripe bill; after each the bill's kept amount is
# the amount before the first. A fee that takes a written-down bill above its kept amount moves the kept amount up, on
# each writer. It ends with "write_down_first_amount PASSED". The second scenario commits, since each write-down must
# be a transaction of its own for its stamp to move: every write-down on each writer leaves a line on the job's
# activity, with its own before and after and its person, and a replayed stamp or a fee leaves none. The write-down
# after a fee starts from the amount the fee left, one at the amount the bill stands at reads that amount twice, and a
# bill that arrives written down has one line. It ends with "write_down_each_step PASSED". Each raises on its first
# failed assertion. PGTEST_KEEP=1 leaves the container up.
# Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55909}"
NAME="pgtest-write-down-first-amount"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_write_down_keeps_first_amount.sql supabase/migrations/*_write_down_activity_each_step.sql)"

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
# A second run must change nothing: CREATE OR REPLACE.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/write_down_first_amount/20_scenario.sql 2>&1 || true)"
if ! grep -q "write_down_first_amount PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/write_down_first_amount/30_each_step.sql 2>&1 || true)"
if ! grep -q "write_down_each_step PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "write-down-first-amount bed ok"
