#!/usr/bin/env bash
# Runs supabase/tests/gc_clause_papers against a throwaway copy of the WHOLE schema (Messages, cut 4c's next piece: a
# statement of work and our contract built from clauses).
#
#   npm run test:pg:gc-clause-papers
#
# The same bed as scripts/pgtest-contract-clauses.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the clause papers' migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: who picks a paper and every refusal; the trade's statement of work signs only at the
# revision its page showed and keeps the job's clauses and its own trade's exhibit; one with no paper signs as before; the
# customer's contract the same; Mark it signed freezes the newest send; a retire after signing leaves the copy; the sign
# verbs keep one signature each, the service role's. It raises on its first failed assertion and ends with
# "gc_clause_papers PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55476}"
NAME="pgtest-gc-clause-papers"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_clause_papers.sql)"

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
# A second run must change nothing: the columns, the indexes and the functions are there, with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_clause_papers/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_clause_papers PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-clause-papers bed ok"
