#!/usr/bin/env bash
# Runs supabase/tests/permit_skim against a throwaway copy of the WHOLE schema (v2.6835, punch list #302: the skim's
# ground; migration *_permit_skim).
#
#   npm run test:pg:permit-skim
#
# The Supabase Postgres image with every file in supabase/migrations applied in order, then this migration a second
# time, which must change nothing. The probe, inside one transaction that rolls back: the service role alone sets a
# permit's builder key; research_permits_v2 puts the builder beside each row; a keep shows who it is for; a put-back
# reads as unanswered on both reads; a pursue takes one of three purposes; a mark needs its reason, the newest wins and
# none clears it; a builder row is written in the writer's own name; Builders lists each name with its permits, its
# plumber and its mark; the count adds up; a helper reads and marks nothing; the fences reached both tables and anon
# runs none of the new functions. It raises on its first failed assertion and ends with "permit_skim PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55577}"
NAME="pgtest-permit-skim"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_permit_skim.sql)"
LATER="$(ls supabase/migrations/*_permit_history.sql supabase/migrations/*_permit_reads_indexed.sql)"

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
# A second run must change nothing: the columns and tables stand, the policies and checks are remade the same.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
# That second run put the skim's first bodies of the reads back, so the migrations that rewrote them since run again
# in their order: the probe then reads the functions prod runs.
for later in $LATER; do
  psql_as postgres -f - < "$later" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $later"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/permit_skim/20_scenario.sql 2>&1 || true)"
if ! grep -q "permit_skim PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "permit-skim bed ok"
