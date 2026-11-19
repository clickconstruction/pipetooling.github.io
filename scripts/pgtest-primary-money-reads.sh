#!/usr/bin/env bash
# Runs supabase/tests/primary_money_reads against a throwaway copy of the WHOLE schema (a primary's money reads on one
# job held to the job's people, punch list #400 PR 2).
#
#   npm run test:pg:primary-money-reads
#
# The same bed as scripts/pgtest-primary-paid-verbs.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the reads' migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: a primary who account-manages a job reads its activity with the
# money lines, its supply house bills, its parts, its accounts and its payment's lines, and none of another job's; a
# primary on nothing reads neither; a primary on a job's crew reads its plain lines, name and accounts and none of
# its money; the assistant and a helper on the crew read as before. It raises on its first failed assertion and ends
# with "primary_money_reads PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs
# it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55694}"
NAME="pgtest-primary-money-reads"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_primary_money_reads.sql)"

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
# A second run must change nothing: CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/primary_money_reads/20_scenario.sql 2>&1 || true)"
if ! grep -q "primary_money_reads PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "primary-money-reads bed ok"
