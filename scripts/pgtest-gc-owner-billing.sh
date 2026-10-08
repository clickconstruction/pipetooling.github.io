#!/usr/bin/env bash
# Runs supabase/tests/gc_owner_billing against a throwaway copy of the WHOLE schema (GC mode, Owner
# Billing's O4a-1: our bill to the customer).
#
#   npm run test:pg:gc-owner-billing
#
# The same bed as scripts/pgtest-gc-schedule.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). O4a-1's migration is then applied a second
# time, which must change nothing (one service type, one trigger). The scenario sends pay applications
# and records certificates through RLS as a dev, the controller, an estimator and a dev in training
# mode, inside one transaction that rolls back: the billing job the first send opens, the bill each
# certificate makes, the links that stay once written, and every refusal in its words. It raises on
# its first failed assertion and ends with "gc_owner_billing PASSED". PGTEST_KEEP=1 leaves the
# container up. Needs docker; .github/workflows/sql-beds.yml runs it on a PR that touches Owner
# Billing's SQL. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55454}"
NAME="pgtest-gc-owner-billing"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
SEND="$(ls supabase/migrations/*_gc_owner_pay_app_send.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
# The registry rate-limits a burst of pulls (every bed in sql-beds.yml pulls this image at once), so a
# refused pull waits and tries again before the bed gives up.
for i in 1 2 3 4 5; do docker pull -q "$IMAGE" >/dev/null 2>&1 && break; [ "$i" = 5 ] && { echo "could not pull $IMAGE"; exit 1; }; sleep $((i * 15)); done
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run must change nothing: the service type's insert skips the row it made, the columns and
# the index are there, and every function and the trigger are replaced as they were.
psql_as postgres -f - < "$SEND" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED re-applying $SEND"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_owner_billing/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_owner_billing PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-owner-billing bed ok"
