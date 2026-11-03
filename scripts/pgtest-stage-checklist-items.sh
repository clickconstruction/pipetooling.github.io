#!/usr/bin/env bash
# Runs supabase/tests/stage_checklist_items against a throwaway copy of the WHOLE schema (punch list #237 PR 1 and PR 1b:
# who may add, read, take off, order and promote a stage checklist item on a job, and skip a company question on one;
# v2.6350: a stage's checklist follows its line through a split or a combine; and v2.6420: the job form's billing save
# keeps the job's line ids, so a save takes nothing off a stage).
#
#   npm run test:pg:stage-checklist-items
#
# The same bed as scripts/pgtest-messages-tech-send.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then these two migrations a second time, in their order, which must change nothing.
# The scenario, inside one transaction that rolls back: who adds, a stage that is not on the job, who reads, who takes off
# and what the adder may write, the answer kept, the company's rows, the training and twin fences, who authors, the order
# of a stage's own checks, the skip and its put back, and the promote. It raises on its first failed assertion and ends
# with "stage_checklist_items PASSED". Then rows an earlier split stranded are seeded (30_stranded_rows.sql), the follow
# migration runs a second time and repairs them, and 40_follow_the_line.sql answers a stage, adds items and skips, splits
# and combines, and raises at the end with everything lost; it ends with "follow_the_line PASSED". Last,
# 50_billing_save_keeps_lines.sql seeds two jobs alike, replays the billing save before v2.6420 on one and the save since on
# the other, as the office under RLS, and raises at the end with what the save lost; it ends with
# "billing_save_keeps_lines PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker;
# the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55547}"
NAME="pgtest-stage-checklist-items"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# In their order: the later one replaces the add gate the earlier one writes, so a re-run of the earlier alone would put
# the old gate back and the scenario would pin the wrong one.
WRITES="$(ls supabase/migrations/*_stage_checklist_job_items.sql supabase/migrations/*_stage_checklist_skips_and_authors.sql)"
FOLLOW="$(ls supabase/migrations/*_stage_checklist_rows_follow_their_line.sql)"

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
pgtest_apply supabase/migrations/*.sql
# A second run must change nothing: the columns, the table, the triggers, the functions and the gates as they were.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/stage_checklist_items/20_scenario.sql 2>&1 || true)"
if ! grep -q "stage_checklist_items PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
psql_as postgres -f - < supabase/tests/stage_checklist_items/30_stranded_rows.sql >/dev/null 2>"$ERR" || { echo "FAILED seeding the stranded rows"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
psql_as postgres -f - < "$FOLLOW" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $FOLLOW"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
follow="$(psql_as postgres -f - < supabase/tests/stage_checklist_items/40_follow_the_line.sql 2>&1 || true)"
if ! grep -q "follow_the_line PASSED" <<<"$follow"; then echo "$follow" | tail -60; exit 1; fi
grep -o "ok: .*" <<<"$follow"
keeps="$(psql_as postgres -f - < supabase/tests/stage_checklist_items/50_billing_save_keeps_lines.sql 2>&1 || true)"
if ! grep -q "billing_save_keeps_lines PASSED" <<<"$keeps"; then echo "$keeps" | tail -60; exit 1; fi
grep -o "ok: .*" <<<"$keeps"
echo "stage-checklist-items bed ok"
