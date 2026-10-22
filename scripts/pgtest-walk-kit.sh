#!/usr/bin/env bash
# Runs supabase/tests/walk_kit against a throwaway copy of the WHOLE schema (v2.5725, punch list #142 PR 4: walk_setup
# and walk_cleanup, migration *_walk_kit).
#
#   npm run test:pg:walk-kit
#
# The same bed as scripts/pgtest-tech-bio.sh: every file in supabase/migrations applied in order, then this
# migration a second time, which must change nothing. The scenario, inside one transaction that rolls back: setup
# makes the kit once from Settings' boxes row and answers the same kit twice; it refuses a maker who is not the
# tester, a bids box with no address or number, the two boxes on one number, the kit's phone on the team number, and
# any contact carrying the kit's email or phone, the team box's address or number, or the app's sender; cleanup
# deletes only the kit's rows while a real customer beside it keeps every row, and refuses a line folded in on a
# stranger's channel, a file kept on the thread, another carrier of the kit's address, and a foreign key from a table
# it does not know; after cleanup no contact carries bids@ or the bids number. It raises on its first failed
# assertion and ends with "walk_kit PASSED". Never touches prod.
#
# Two ways to get the Postgres:
#   * Docker (default): the Supabase Postgres image, prod's own, with combined_copies/00_prod_extras.sql first (the
#     SQL beds workflow runs it this way from scripts/sql-beds.txt on a ready PR that touches a migration);
#   * PGTEST_PGBIN=/path/to/postgres/bin — a local install's initdb / pg_ctl, for a machine without Docker (brew:
#     /usr/local/opt/postgresql@15/bin), with supabase/tests/walk_kit/00_local_extras.sql standing in for what the
#     image has (auth, extensions, storage, cron, net, vault, the realtime publication) and the baseline's MAINTAIN
#     grants (Postgres 17) left out. PGTEST_PORT picks the port (default 55531; use a free high one on a shared Mac).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55531}"
NAME="pgtest-walk-kit"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
BED="supabase/tests/walk_kit"
WRITES="$(ls supabase/migrations/*_walk_kit.sql)"
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
  psql_as postgres -f - < "$BED/00_local_extras.sql" >/dev/null 2>"$ERR" || { echo "FAILED applying $BED/00_local_extras.sql"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
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
# A second run must change nothing: the functions, their comments and grants.
apply "$WRITES" | psql_as postgres -f - >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "walk_kit PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "walk-kit bed ok"
