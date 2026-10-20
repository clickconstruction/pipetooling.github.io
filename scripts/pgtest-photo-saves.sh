#!/usr/bin/env bash
# Runs supabase/tests/photo_saves against a throwaway copy of the WHOLE schema (Messages, cut 10: a job's tick to save
# its photos to Drive, and the mark on a text's picture we could not copy).
#
#   npm run test:pg:photo-saves
#
# The same bed as scripts/pgtest-drive-links.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the photo saves' migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: the office turns a job's tick on and off, stamped, on keeping its first time and off
# clearing it; nobody else can, nor training mode, a twin or anyone signed out, and nobody writes the table by hand; the
# office alone reads the ticks; the three fences are on the table; a text's picture not copied is marked quo_not_copied.
# It raises on its first failed assertion and ends with "photo_saves PASSED". PGTEST_KEEP=1 leaves the container up.
# Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55512}"
NAME="pgtest-photo-saves"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_photo_saves.sql)"

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
# A second run must change nothing: the table, its columns, checks and indexes are there, and the functions with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/photo_saves/20_scenario.sql 2>&1 || true)"
if ! grep -q "photo_saves PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "photo-saves bed ok"
