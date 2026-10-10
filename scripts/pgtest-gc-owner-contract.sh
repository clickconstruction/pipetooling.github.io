#!/usr/bin/env bash
# Runs supabase/tests/gc_owner_contract against a throwaway copy of the WHOLE schema (the Board's B6-d-i: our contract
# to the customer, sent from their window and signed in their portal).
#
#   npm run test:pg:gc-owner-contract
#
# The same bed as scripts/pgtest-gc-start.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The contract's migration is then applied a second time, which must change
# nothing. The scenario, inside one transaction that rolls back: who may send our contract, each refusal in words,
# the first send and a new price, who reads the sends and their files, the customer's signing as the service role with
# each refusal by its key, and Mark it signed before and after a portal signature. Owner Billing's own bed
# (scripts/pgtest-gc-owner-billing.sh) covers Mark it signed as it was, unchanged. src/lib/gc/ownerContractSql.test.ts
# holds every refusal it asserts to the plain-words rules. It raises on its first failed assertion and ends with
# "gc_owner_contract PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55461}"
NAME="pgtest-gc-owner-contract"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_owner_contract_sends.sql)"

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
# A second run must change nothing: the table, the bucket and its policies are there, and every function is replaced
# as it was, with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_owner_contract/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_owner_contract PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-owner-contract bed ok"
