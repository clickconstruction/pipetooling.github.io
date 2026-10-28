#!/usr/bin/env bash
# Runs supabase/tests/gc_schedule against a throwaway copy of the WHOLE schema (v2.4848, the schedule's PR 5;
# the team door, v2.5114, the schedule's PR 10; the builder's rows, v2.6020, punch list #204 PR 2).
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
# The team door (50_team_door.sql) then proves who the 23 tables let in, on its own
# fixture, ending "gc_schedule team door PASSED". Since #204's PR 2 the builder's migration is applied a
# second time too, and 60_builder.sql plays the phases on a draft and a template saved as a new row and a
# new version, ending "gc_schedule builder PASSED".
# PGTEST_KEEP=1 leaves the container up. Never touches prod.
#
# Two ways to get the Postgres:
#   * Docker (default): the Supabase Postgres image, prod's own, with combined_copies/00_prod_extras.sql first
#     (.github/workflows/sql-beds.yml runs it this way on a PR that touches the schedule's SQL);
#   * PGTEST_PGBIN=/path/to/postgres/bin — a local install's initdb / pg_ctl, for a machine without Docker (brew:
#     /usr/local/opt/postgresql@15/bin), with supabase/tests/walk_kit/00_local_extras.sql standing in for what the
#     image has and the baseline's MAINTAIN grants (Postgres 17) left out. PGTEST_PORT picks the port (default
#     55443; use a free high one on a shared Mac).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55443}"
NAME="pgtest-gc-schedule"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_schedule_writes.sql)"
TELLS="$(ls supabase/migrations/*_gc_schedule_tells.sql)"
TRADE_WRITES="$(ls supabase/migrations/*_gc_schedule_trade_writes.sql)"
DOOR="$(ls supabase/migrations/*_gc_schedule_team_door.sql)"
BUILDER="$(ls supabase/migrations/*_gc_schedule_builder.sql)"
# psql's errors go to this run's own file: a fixed /tmp name may belong to another user on a shared Mac.
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"

if [ -n "${PGTEST_PGBIN:-}" ]; then
  command -v psql >/dev/null || { echo "psql not on PATH"; exit 2; }
  TMP="$(mktemp -d)"
  export LC_ALL=C  # macOS: a postmaster started without a locale "became multithreaded during startup"
  "$PGTEST_PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --locale=C >/dev/null
  "$PGTEST_PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c timezone=UTC" -l "$TMP/log" -w start >/dev/null
  trap '"$PGTEST_PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1; rm -rf "$TMP"; rm -f "$ERR"' EXIT
  grep -q "could not bind" "$TMP/log" && { echo "port $PORT is taken (set PGTEST_PORT)"; exit 2; }
  for _ in $(seq 1 60); do pg_isready -h 127.0.0.1 -p "$PORT" -U postgres >/dev/null 2>&1 && break; sleep 1; done
  psql_as() { shift; psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
  psql_as postgres -f - < supabase/tests/walk_kit/00_local_extras.sql >/dev/null 2>"$ERR" || { echo "FAILED applying supabase/tests/walk_kit/00_local_extras.sql"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  # The baseline's MAINTAIN is Postgres 17's privilege; a 15 does not know the word.
  apply() { sed -e 's/,MAINTAIN//g' -e 's/MAINTAIN,//g' "$1"; }
else
  command -v docker >/dev/null || { echo "docker not on PATH (or set PGTEST_PGBIN)"; exit 2; }
  docker info >/dev/null 2>&1 || { echo "docker is not running (or set PGTEST_PGBIN)"; exit 2; }
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  . scripts/pgtest-pull.sh
  pgtest_pull_supabase "$IMAGE"
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
  trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1; rm -f "$ERR"' EXIT
  for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
  sleep 5
  psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
  psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
  apply() { cat "$1"; }
fi

for f in supabase/migrations/*.sql; do
  apply "$f" | psql_as postgres -f - >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# A second run must change nothing: every function is replaced as it was, and the guard's DO block
# makes no second trigger. The later migrations that replace a function go after the earlier ones, in
# order, so the bed runs on the functions as prod has them.
for again in "$WRITES" "$TELLS" "$TRADE_WRITES" "$DOOR" "$BUILDER"; do
  apply "$again" | psql_as postgres -f - >/dev/null 2>"$ERR" || { echo "FAILED re-applying $again"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
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
# The team door (the schedule's PR 10): who the 23 tables let in, on its own fixture.
out="$(psql_as postgres -f - < supabase/tests/gc_schedule/50_team_door.sql 2>&1 || true)"
if ! grep -q "gc_schedule team door PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
# The builder's rows (#204 PR 2): the phases on a draft, a template saved as a new row and a new version.
out="$(psql_as postgres -f - < supabase/tests/gc_schedule/60_builder.sql 2>&1 || true)"
if ! grep -q "gc_schedule builder PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-schedule bed ok"
