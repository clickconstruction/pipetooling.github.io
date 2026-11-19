#!/usr/bin/env bash
# Runs supabase/tests/stage_kind against a throwaway copy of the WHOLE schema (punch list #397 PR 6: one rule for
# the stage a line's name reads as, stage_checklist_kind_of in step with the app's stageRank).
#
#   npm run test:pg:stage-kind
#
# The same bed as scripts/pgtest-dashboard-view.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the function's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back, asks the function for every name in STAGE_NAME_TABLE
# (src/lib/jobs/stageNameTable.ts) and holds each answer to the app's: the start of the name gives the stage, a
# leading "Stage 2" is dropped, "Set trim" is trim, a name with another stage's word stands for none, and a stage's
# word in the middle of a sentence gives nothing. It raises on its first failed assertion and ends with
# "stage_kind PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55850}"
NAME="pgtest-stage-kind"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_stage_kind_one_rule.sql)"

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
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/stage_kind/20_scenario.sql 2>&1 || true)"
if ! grep -q "stage_kind PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "stage-kind bed ok"
