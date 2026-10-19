#!/usr/bin/env bash
# Runs supabase/tests/paid_claim against a throwaway copy of the WHOLE schema (they say they paid, punch list #129
# PR 3a: the paid_claim kind of job_payment_promises and add_job_payment_claim).
#
#   npm run test:pg:paid-claim
#
# The same bed as scripts/pgtest-job-people.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the claim migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: the bid's estimator writes a promise and a claim, the per-job read names both kinds
# with the claim's method and amount, the board's date follows the promise and ignores the claim, the company-wide
# reads and the pay-speed records answer promises only, a bad method, no method, no day, a zero amount, a bad channel
# and a stranger are refused in words, a claim voids as a promise does, and the shape constraints hold under a direct
# write. It raises on its first failed assertion and ends with "paid_claim PASSED". PGTEST_KEEP=1 leaves the container
# up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55516}"
NAME="pgtest-paid-claim"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_paid_claim.sql)"

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
# A second run must change nothing: IF NOT EXISTS on the columns, guarded constraints, CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/paid_claim/20_scenario.sql 2>&1 || true)"
if ! grep -q "paid_claim PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "paid-claim bed ok"
