#!/usr/bin/env bash
# Runs supabase/tests/gc_schedule against a throwaway copy of the WHOLE schema (v2.4848, the schedule's PR 5).
#
#   npm run test:pg:gc-schedule
#
# The same bed as scripts/pgtest-bid-changes.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The schedule's writes are then applied a
# second time, which must change nothing. The scenario draws, moves, undoes, splits and keeps as a dev
# through RLS, inside one transaction that rolls back: two presses on one version, the refusals in the
# kernels' words, the plan at Start, the records that touch several rows, and the guard. It raises on
# its first failed assertion and ends with "gc_schedule PASSED". Since the schedule's PR 13a the tells'
# two writes are applied a second time too, and 30_tells.sql plays Tell the trades and a trade's answer
# on a job of its own, ending "gc_schedule tells PASSED". Since PR 14a the trade's four writes are applied a second
# time too, and 40_trade_writes.sql plays them on a job of its own, ending "gc_schedule trade writes PASSED".
# PGTEST_KEEP=1 leaves the container
# up. Needs docker; .github/workflows/sql-beds.yml runs it on a PR that touches the schedule's SQL.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55443}"
NAME="pgtest-gc-schedule"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_schedule_writes.sql)"
TELLS="$(ls supabase/migrations/*_gc_schedule_tells.sql)"
TRADE_WRITES="$(ls supabase/migrations/*_gc_schedule_trade_writes.sql)"

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
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# A second run must change nothing: every function is replaced as it was, and the guard's DO block
# makes no second trigger.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
psql_as postgres -f - < "$TELLS" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $TELLS"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
psql_as postgres -f - < "$TRADE_WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $TRADE_WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_schedule/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_schedule PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
# Tell the trades and their answers (the schedule's PR 13a): a job of its own, in a transaction of its own.
out="$(psql_as postgres -f - < supabase/tests/gc_schedule/30_tells.sql 2>&1 || true)"
if ! grep -q "gc_schedule tells PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
# A trade's four writes from its portal (the schedule's PR 14a): a job of its own, in a transaction of its own.
out="$(psql_as postgres -f - < supabase/tests/gc_schedule/40_trade_writes.sql 2>&1 || true)"
if ! grep -q "gc_schedule trade writes PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-schedule bed ok"
