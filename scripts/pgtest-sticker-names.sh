#!/usr/bin/env bash
# Runs supabase/tests/sticker_names against a throwaway copy of the WHOLE schema (v2.7312, punch list #329 section 10
# PR 7: a run of stickers that names its boxes).
#
#   npm run test:pg:sticker-names
#
# The same bed as scripts/pgtest-on-site-guards.sh: the Supabase Postgres image migrated through pgtest_migrate, then
# the names' migration a second time, which must change nothing. The scenario plays mint_sticker_run, sticker_by_code
# and place_sticker through RLS as a dev inside one transaction that rolls back: a numbered run as before, a named run's
# stickers in number order with the run's first and last, the refusals in words before a number is taken, G1 to G100C in
# print order, and a blank sticker typed no name making a box of its own name. Since v2.7406 (PR 10) a second scenario
# plays place_sticker_range, These are on boxes: a range placed in one call across a site of two jobs, the same range
# again, a refused name held while the rest go on, and who is refused. Since v2.7564 (punch list #373) a third plays the printed mark: box_stickers.printed_at
# written by whoever reads the sticker with the server's own time, taken back off, and no other column open. Each raises on its first failed assertion
# and ends with "sticker_names PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs
# it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55796}"
NAME="pgtest-sticker-names"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The guards, applied a second time below.
PRESSES=(
  supabase/migrations/*_sticker_run_names.sql
  supabase/migrations/*_place_sticker_range.sql
  supabase/migrations/*_sticker_printed.sql
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
# A second run must change nothing: every function and trigger is CREATE OR REPLACE, the column ADD IF NOT EXISTS.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/sticker_names/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "sticker_names PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "sticker-names bed ok"
