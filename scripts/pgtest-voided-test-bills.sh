#!/usr/bin/env bash
# Runs supabase/tests/voided_test_bills against a throwaway copy of the WHOLE schema (punch list #443, row 7: a voided
# test bill leaves a record).
#
#   npm run test:pg:voided-test-bills
#
# The same bed as scripts/pgtest-lien-notice-record-delete.sh: the Supabase Postgres image migrated through
# pgtest_migrate (every file in supabase/migrations in order, or in CI the leg's migrated copy), then the row's
# migration a second time, which must change nothing. The scenario plays the voided_test_bills table through RLS,
# inside one transaction that rolls back: the table carries the four fences and grants a signed-in account SELECT
# alone; the service role, which is the edge function, writes a record; a dev reads it; an assistant, a helper and
# nobody signed in read nothing; no signed-in role inserts, updates or deletes one, the dev included; a training-mode
# dev and a twin write nothing; sends refuses a value that is not a list and bill a value that is not an object; a
# second record for the same bill is refused, and passed over when the function asks for that; deleting the ZZ job
# takes its records. It raises on its first failed assertion and ends with "voided_test_bills PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a
# ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55708}"
NAME="pgtest-voided-test-bills"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_voided_test_bills.sql)"

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
# A second run must change nothing: IF NOT EXISTS, and the policy is dropped before it is made.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/voided_test_bills/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "voided_test_bills PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "voided-test-bills bed ok"
