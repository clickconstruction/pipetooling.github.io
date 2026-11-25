#!/usr/bin/env bash
# Runs supabase/tests/job_paper_gc_proposals against a throwaway copy of the WHOLE schema (punch list #389 step 6: a GC
# proposes a stricter setting for a job's paper, and the office takes it or declines).
#
#   npm run test:pg:job-paper-gc-proposals
#
# The same bed as scripts/pgtest-job-papers-gc-page.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: only the service key proposes, for the customer who is the job's GC; a
# proposal that loosens a topic, changes nothing, has no name or skips the notice's box is refused; one that stands
# changes no paper; a newer one, the office's own change and the paper coming off the job each overtake the one
# waiting; the office declines with a reason or takes it, in place while nobody has signed and as a new version once
# somebody has; and the GC's page reads the picks, the list and the last proposal. It raises on its first failed
# assertion and ends with "job_paper_gc_proposals PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55918}"
NAME="pgtest-job-paper-gc-proposals"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_job_paper_gc_proposals.sql)"

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
# A second run must change nothing: the table, its policy and its trigger made once, functions replaced with the same grants.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/job_paper_gc_proposals/20_scenario.sql 2>&1 || true)"
if ! grep -q "job_paper_gc_proposals PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "job-paper-gc-proposals bed ok"
