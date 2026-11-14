#!/usr/bin/env bash
# Runs supabase/tests/painted_maps against a throwaway copy of the WHOLE schema (v2.7202, punch list #345 PR 1: Paint a
# map; migration *_painted_maps).
#
#   npm run test:pg:painted-maps
#
# The same bed as scripts/pgtest-away-notes.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The scenario, inside one transaction
# that rolls back: the three tables carry the fences and the photo bucket is private; a dev paints maps on a job, on a
# development and on nothing; the checks hold a line whole (two points or more, a list, one of three ways, a measured
# length with how it was measured); a helper on the job's crew reads the job's map and its development's, adds a stroke
# and a place of his own, signs only as himself, and changes or removes nothing of another's; a helper on no crew reads
# and adds nothing; the office reads every map and may change another's stroke; the bucket's objects follow the map
# from the path's first folder; an account in training and a twin write nothing; someone who left reads nothing; a map
# whose job is gone stays with its maker and the office, and a map thrown away takes its lines and places. It raises on
# its first failed assertion and ends with "painted_maps PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker;
# the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55619}"
NAME="pgtest-painted-maps"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_painted_maps.sql)"

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
# A second run must change nothing: the tables stand, every policy is remade the same, the bucket is already there.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/painted_maps/20_scenario.sql 2>&1 || true)"
if ! grep -q "painted_maps PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "painted-maps bed ok"
