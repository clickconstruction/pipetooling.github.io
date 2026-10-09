#!/usr/bin/env bash
# Runs supabase/tests/pay_applications against a throwaway copy of the WHOLE schema (v2.4490).
#
#   npm run test:pg:pay-applications
#
# job_pay_applications is read and written through RLS by the office set, stamped by a trigger
# and fenced for read-only accounts, so the bed is not a stand-in: it is the Supabase Postgres
# image with every file in supabase/migrations applied in order (about a minute). The prod
# extras (pg_cron, pg_net, the storage tables) come from the combined_copies bed. The scenario
# runs inside one transaction that rolls back, raises on its first failed assertion and ends
# with "pay_applications PASSED". PGTEST_KEEP=1 leaves the container up.
# Needs docker. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55441}"
NAME="pgtest-pay-applications"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
BED="supabase/tests/pay_applications"
# The newest migration of the table, re-run to prove it changes nothing. Not an older file: its
# CREATE OR REPLACE of the stamp trigger would undo the newest definition (v2.5032's, the hazard
# docs/MIGRATIONS.md warns of), and the bed would then test the old trigger.
MIGRATION="supabase/migrations/20261010002000_job_pay_applications_invoice.sql"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
[ -n "${PGTEST_KEEP:-}" ] || trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < "supabase/tests/combined_copies/00_prod_extras.sql" >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "/tmp/$NAME.err" | head -20; exit 1; }
done
# A second run of the migration must change nothing.
psql_as postgres -f - < "$MIGRATION" >/dev/null 2>&1
out="$(psql_as postgres -f - < "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "pay_applications PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "pay-applications bed ok"
