#!/usr/bin/env bash
# Runs supabase/tests/bill_pay_codes against a throwaway copy of the WHOLE schema (the bill text's short link, punch
# list #290 PR 2, migration *_bill_pay_codes).
#
#   npm run test:pg:bill-pay-codes
#
# The same bed as scripts/pgtest-estimate-share-links.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the bill pay codes migration a second time, which must change nothing.
# The scenario, inside one transaction that rolls back: the office asks for two bills' codes and gets ten letters from
# the alphabet with no look-alikes, a second ask answers the same code and the two bills differ; a bill not there, a
# primary, a training account, a twin and anon are refused; the row keeps the code, the unique index and the shape
# check hold, and the function runs as its caller. It raises on its first failed assertion and ends with
# "bill_pay_codes PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55519}"
NAME="pgtest-bill-pay-codes"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_bill_pay_codes.sql)"

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
# A second run of each must change nothing: the tables are kept, the policies and the functions made again the same.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/bill_pay_codes/20_scenario.sql 2>&1 || true)"
if ! grep -q "bill_pay_codes PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "bill-pay-codes bed ok"
