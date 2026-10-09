#!/usr/bin/env bash
# Runs supabase/tests/gc_papers against a throwaway copy of the WHOLE schema (the Board's B6-b-i, a trade partner
# company's papers).
#
#   npm run test:pg:gc-papers
#
# The same bed as scripts/pgtest-gc-award.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The papers' migration is then applied a second time, which must change nothing.
# The scenario, inside one transaction that rolls back: a company's paper under its stored name and no person, the
# CHECK both ways, the person trigger deriving a company and leaving a person's paper as it was, every send with its
# promise, who may send, and a project's or a company's delete. It raises on its first failed assertion and ends
# with "gc_papers PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; .github/workflows/sql-beds.yml runs it
# on a PR that touches the papers' SQL.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55445}"
NAME="pgtest-gc-papers"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_papers.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run must change nothing: every function is replaced as it was, and each DO block adds no
# second constraint.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_papers/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_papers PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-papers bed ok"
