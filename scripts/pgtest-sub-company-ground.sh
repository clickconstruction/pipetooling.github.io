#!/usr/bin/env bash
# Runs supabase/tests/sub_company_ground against a throwaway copy of the WHOLE schema (where an outside signer lives,
# step 5, the ground, punch list #403: a roster person works for a trade company, the office makes a company's paper,
# and a person's paper says who they sign for).
#
#   npm run test:pg:sub-company-ground
#
# The same bed as scripts/pgtest-paper-party.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the step's migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: the link is the office's four roles' to read and to write, and an estimator, a primary,
# a superintendent, a sub, a digital twin, a training account, an archived account and a caller who is not signed in
# read no row and write nothing; a person's paper takes signing_for when it is made and each time it is sent, an unsent
# paper follows the link and the company's name, and a signed paper never changes; the four roles make a company's
# paper and nobody else does; the one-press door finds a company by its name or makes it once; and each role reads the
# papers it read before, an estimator no person's paper among them. It raises on its first failed assertion and ends
# with "sub_company_ground PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it
# from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55909}"
NAME="pgtest-sub-company-ground"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_sub_company_ground.sql)"

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
# A second run must change nothing: the table, its policy, the doors, the triggers and the fences are there.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/sub_company_ground/20_scenario.sql 2>&1 || true)"
if ! grep -q "sub_company_ground PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "sub-company-ground bed ok"
