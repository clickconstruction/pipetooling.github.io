#!/usr/bin/env bash
# Runs supabase/tests/bridge_moves against a throwaway copy of the WHOLE schema (v2.6864, punch list #303 PR 4: the
# Bridge's call reaches its people).
#
#   npm run test:pg:bridge-moves
#
# The same bed as scripts/pgtest-theme-review.sh: the Supabase Postgres image migrated through pgtest_migrate (every
# file in supabase/migrations in order, or in CI the leg's migrated copy), then the migration a second time, which
# must change nothing. The scenario plays bridge_my_moves and bridge_mark_my_move_done through RLS as an assistant, an
# owner and an estimator, inside one transaction that rolls back: the table stays closed to the assistant, each person
# reads only the moves that carry their own account, a move that is someone else's or not on the call is refused in
# words, Done stamps that one move and nothing else, and the moves leave once Friday is answered, the week has
# passed, a newer call stands, or the account is archived. It raises on its first failed assertion and ends with
# "bridge_moves PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55611}"
NAME="pgtest-bridge-moves"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The two functions, applied a second time below.
PRESSES=(
  supabase/migrations/*_bridge_moves_reach_people.sql
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
# A second run must change nothing: both functions are CREATE OR REPLACE and their grants are restated.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/bridge_moves/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "bridge_moves PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "bridge-moves bed ok"
