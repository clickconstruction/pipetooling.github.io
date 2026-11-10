#!/usr/bin/env bash
# Runs supabase/tests/on_site_move against a throwaway copy of the WHOLE schema (v2.6808, punch list #209: everything
# a job holds on site moved to another job).
#
#   npm run test:pg:on-site-move
#
# The same bed as scripts/pgtest-dev-clock-session-write.sh: the Supabase Postgres image migrated through
# pgtest_migrate (every file in supabase/migrations in order, or in CI the leg's migrated copy), then the move's
# migration a second time, which must change nothing. The scenario plays dev_on_site_move_job through RLS as a dev, an
# estimator, a helper, a dev in training and a twin, inside one transaction that rolls back: every refusal, a dry run
# that reports and unwinds, the apply (a same-name place, Unsorted on both sides, a label the target already holds, a
# retired box, a box's own move, photos filed and waiting), a replay refused, a move onto a job with nothing on site, a
# fold that changes what a line reads, and the trigger that gives a new row its container's job. It raises on its first
# failed assertion and ends with "on_site_move PASSED". The whole-job combine's use of the same rule is held by
# scripts/pgtest-combine-rows.sh, which re-applies the newest file that restates the combine: this one. PGTEST_KEEP=1
# leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that
# touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55568}"
NAME="pgtest-on-site-move"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The move, applied a second time below.
PRESSES=(
  supabase/migrations/*_on_site_move_job.sql
)

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
# A second run must change nothing: every function is CREATE OR REPLACE, each trigger CREATE OR REPLACE TRIGGER.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/on_site_move/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "on_site_move PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "on-site-move bed ok"
