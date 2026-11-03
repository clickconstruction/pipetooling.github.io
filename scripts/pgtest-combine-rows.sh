#!/usr/bin/env bash
# Runs supabase/tests/combine_rows against a throwaway copy of the WHOLE schema (punch list #252: a combine moves every
# row that would have gone with the source job's delete, migration *_combine_moves_every_row).
#
#   npm run test:pg:combine-rows
#
# The same bed as scripts/pgtest-job-people.sh: the Supabase Postgres image migrated through pgtest_migrate (every file
# in supabase/migrations in order, or in CI the leg's migrated copy, which already holds them), then the combine
# migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: a first combine onto a target with none of the one-per-job rows (a plan part, a baseline,
# a budget, a property owner, a photo-save tick), which move; a split that moves a line and its stage window; a combine
# refused on a work-order collision, which moves nothing; and a second combine onto a target that holds every merge case
# (places and containers by name, Messages links and holds, watchers, supply-house accounts and words, Team board marks,
# the hours target, plans), with the let-go caches gone. It writes down each thing lost and raises at the end with the
# whole list, so one run says everything; it ends with "combine_rows PASSED". PGTEST_KEEP=1 leaves the container up.
# Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55549}"
NAME="pgtest-combine-rows"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_combine_moves_every_row.sql)"

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
# A second run must change nothing: every function is CREATE OR REPLACE, the trigger CREATE OR REPLACE TRIGGER.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/combine_rows/20_scenario.sql 2>&1 || true)"
if ! grep -q "combine_rows PASSED" <<<"$out"; then echo "$out" | tail -60; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "combine-rows bed ok"
