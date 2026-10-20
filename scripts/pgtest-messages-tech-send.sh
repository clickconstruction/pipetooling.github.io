#!/usr/bin/env bash
# Runs supabase/tests/messages_tech_send against a throwaway copy of the WHOLE schema (Messages, residential R5: the
# doors quo-send's tech path asks as the tech).
#
#   npm run test:pg:messages-tech-send
#
# The same bed as scripts/pgtest-contact-for-customer.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then this migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: who is on a job this week or last; messages_tech_can_read's answers on it;
# contact_for_job's refusals in words, and the customer's own contact made once for a tech on the job; the office's
# door as it was; the find-or-make body closed to anyone signed in. It raises on its first failed assertion and ends
# with "messages_tech_send PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it
# from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55530}"
NAME="pgtest-messages-tech-send"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_messages_tech_send.sql)"

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
# A second run must change nothing: the five functions with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/messages_tech_send/20_scenario.sql 2>&1 || true)"
if ! grep -q "messages_tech_send PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "messages-tech-send bed ok"
