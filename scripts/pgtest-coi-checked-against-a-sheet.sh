#!/usr/bin/env bash
# Runs supabase/tests/coi_checked_against_a_sheet against a throwaway copy of the WHOLE schema (the Document builder,
# punch list #404 step 6: a trade's certificate held against a job's insurance sheet).
#
#   npm run test:pg:coi-checked-against-a-sheet
#
# The same bed as scripts/pgtest-document-builder-sheets.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: the seven columns are there and empty; only a company's certificate takes a
# job; a dev alone marks one good or sends one back, only on a published sheet, only for a company on a trade of that
# job, with a line ticked and a day that has not passed; a certificate sent back keeps the lines it did not show;
# one marked good keeps the job, the revision and the lines; one checked for a job is never moved to another; a dev
# in training changes nothing; and a job that goes leaves the certificate with no job on it. It raises on its first
# failed assertion and ends with "coi_checked_against_a_sheet PASSED". PGTEST_KEEP=1 leaves the container up. Needs
# docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55908}"
NAME="pgtest-coi-checked-against-a-sheet"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_coi_checked_against_a_sheet.sql)"

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
# A second run must change nothing: ADD COLUMN IF NOT EXISTS, the constraint made once, and CREATE OR REPLACE.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/coi_checked_against_a_sheet/20_scenario.sql 2>&1 || true)"
if ! grep -q "coi_checked_against_a_sheet PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "coi-checked-against-a-sheet bed ok"
