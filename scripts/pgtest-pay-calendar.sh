#!/usr/bin/env bash
# Runs supabase/tests/pay_calendar against a throwaway copy of the WHOLE schema (Pay calendar, punch list #323 PR 1:
# the payer_pay_calendars table and set_payer_pay_calendar).
#
#   npm run test:pg:pay-calendar
#
# The same bed as scripts/pgtest-job-people.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the pay calendar migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: the office sets a payer's calendar and the row stamps who set it, a second set replaces
# the one row, a job carries its own row or an off switch, clearing removes one row and leaves the rest, the
# billed-money roles read the table and a subcontractor reads nothing, a subcontractor, a primary and a read-only account cannot
# set one, days and a month count out of range are refused in words, and the shape and the one row a
# payer hold under a direct write. It raises on its first failed assertion and ends with "pay_calendar PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a
# ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55615}"
NAME="pgtest-pay-calendar"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_payer_pay_calendars.sql)"

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
# A second run must change nothing: IF NOT EXISTS on the table and its indexes, DROP POLICY IF EXISTS, CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/pay_calendar/20_scenario.sql 2>&1 || true)"
if ! grep -q "pay_calendar PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "pay-calendar bed ok"
