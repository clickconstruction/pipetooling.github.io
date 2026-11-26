#!/usr/bin/env bash
# Runs supabase/tests/portal_link_delete against a throwaway copy of the WHOLE schema (punch list #443, row 11: a
# developer deletes a turned-off portal link of a test customer).
#
#   npm run test:pg:portal-link-delete
#
# The same bed as scripts/pgtest-on-site-guards.sh: the Supabase Postgres image migrated through pgtest_migrate (every
# file in supabase/migrations in order, or in CI the leg's migrated copy), then the row's migration a second time,
# which must change nothing. The scenario plays delete_test_portal_link through RLS, inside one transaction that rolls
# back: an assistant is refused at the door; a dev is refused a live link, a real customer's turned-off link, a link a
# GC's proposal names and a link that is not there; a dev deletes a ZZ Test customer's turned-off link, and it is gone
# while the others stand; a direct DELETE on the table is refused for everyone. It raises on its first failed assertion
# and ends with "portal_link_delete PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow
# runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55699}"
NAME="pgtest-portal-link-delete"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_portal_link_delete_test.sql)"

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
# A second run must change nothing: both functions are CREATE OR REPLACE.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/portal_link_delete/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "portal_link_delete PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "portal-link-delete bed ok"
