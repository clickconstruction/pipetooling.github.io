#!/usr/bin/env bash
# Runs supabase/tests/job_paper_settings against a throwaway copy of the WHOLE schema (punch list #389 step 3:
# settings on the job, the ground).
#
#   npm run test:pg:job-paper-settings
#
# The same bed as scripts/pgtest-paper-settings.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then this step's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: one set of cases runs through the database (which way a change of
# picks goes, the picks in plain words, the seal), and the same cases run through the kernel in
# src/lib/contracts/jobPaperSettings.cases.test.ts, which reads them out of the scenario file. Then a job with no
# settings behaves as before, a paper built from settings is required with its picks and refused without, only a ZZ
# Test job takes a paper no attorney has read, only the office sets a job's settings and never a twin, training or
# someone who left, a copy is made for the job and never bare, a copy is signed only with the paper frozen as the
# database reads it, the row locks at the first signature, a change after it, tighter or looser, makes a new row, a
# later clause edit leaves the signed words as they were, and the ground under step 4: the shape of a choice's breach
# and site lines, the notice's box, and the basis. It raises on its first failed assertion and ends with
# "job_paper_settings PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55904}"
NAME="pgtest-job-paper-settings"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_settings_on_the_job.sql)"
# The ground under step 4 replaces two of that file's functions. It is applied after it, as prod has them.
GROUND="$(ls supabase/migrations/*_settings_page_ground.sql)"

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
# A second run must change nothing: the columns, the check, the trigger and the functions are there, with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
psql_as postgres -f - < "$GROUND" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $GROUND"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/job_paper_settings/20_scenario.sql 2>&1 || true)"
if ! grep -q "job_paper_settings PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-paper-settings bed ok"
