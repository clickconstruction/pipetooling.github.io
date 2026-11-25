#!/usr/bin/env bash
# Runs supabase/tests/job_papers_gc_page against a throwaway copy of the WHOLE schema (punch list #389 step 5: what a
# GC reads about the papers a job requires).
#
#   npm run test:pg:job-papers-gc-page
#
# The same bed as scripts/pgtest-job-papers-lists.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its two migrations a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: the service key reads a job's paper built from settings as its level, its
# plain words, the count over the office's own roster and each sub business with its day; a helper is never named; a
# change after a signature starts the count again; a job with a prose paper or none is left out; nobody signed in reads
# it; the office's roster answers as before; and the office sets what the GC sees, the count alone, the businesses
# or every signer by name, which the next row keeps. It raises on its first failed assertion and ends with
# "job_papers_gc_page PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55917}"
NAME="pgtest-job-papers-gc-page"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# In order: the second replaces a function the first made, so run backwards the bed would test the older one.
WRITES="$(ls supabase/migrations/*_job_papers_gc_page.sql) $(ls supabase/migrations/*_job_paper_gc_view.sql)"

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
# A second run must change nothing: functions replaced with the same grants, columns and a trigger made once.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/job_papers_gc_page/20_scenario.sql 2>&1 || true)"
if ! grep -q "job_papers_gc_page PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-papers-gc-page bed ok"
