#!/usr/bin/env bash
# Runs supabase/tests/sub_sheet_draw_invoice against a throwaway copy of the WHOLE schema (the sub sheet's tie to
# one bill, punch list #388 step 1: people_labor_jobs.draw_invoice_id, its trigger and set_sub_sheet_draw_invoice).
#
#   npm run test:pg:sub-sheet-draw-invoice
#
# The same bed as scripts/pgtest-job-finish-calls.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the tie's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: a sheet that arrives at Waiting on customer through the office's
# own set_sub_sheet_stage takes the job's one open bill, a draft or a sent one, and none on a job with no bill or
# with several; a move back clears the tie; a later bill and a later write leave it; the office picks another bill of
# the job, a paid one too, and clears it, and is refused a bill of another job, a sheet off the stage and a sheet
# that does not exist; a helper is refused; a tie written past the function is held to the same rules; moving the
# sheet to another job and deleting the bill both clear it; and a sheet born at the stage with only its job's number
# is linked first and tied second. It raises on its first failed assertion and ends with
# "sub_sheet_draw_invoice PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it
# from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55850}"
NAME="pgtest-sub-sheet-draw-invoice"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_sub_sheet_draw_invoice.sql)"

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
# A second run must change nothing: IF NOT EXISTS, CREATE OR REPLACE, and the trigger dropped and made again.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/sub_sheet_draw_invoice/20_scenario.sql 2>&1 || true)"
if ! grep -q "sub_sheet_draw_invoice PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "sub-sheet-draw-invoice bed ok"
