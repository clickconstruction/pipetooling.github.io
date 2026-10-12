#!/usr/bin/env bash
# Runs supabase/tests/gc_change_orders_from_messages against a throwaway copy of the WHOLE schema (Messages, cut 4b: a
# change order started from a customer's message, drafted by the office and sent to sign by the money team).
#
#   npm run test:pg:gc-change-orders-from-messages
#
# The same bed as scripts/pgtest-gc-owner-contract.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The migration is then applied a second time, which must change
# nothing. The scenario, inside one transaction that rolls back: Rosa (the office) drafts change order 2 from Priya's
# text through gc_draft_change_order_from_message and reads it through gc_change_orders_office only; each refusal in
# words; a superintendent, a training account and a digital twin refused; Maria (the money team) prices the draft and
# sends it to sign through gc_send_change_order_to_sign, a reminder after; nobody changes or deletes a send, and the
# office reads none. It raises on its first failed assertion and ends with "gc_change_orders_from_messages PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR
# that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55473}"
NAME="pgtest-gc-change-orders-from-messages"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_change_orders_from_messages.sql)"

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
# A second run must change nothing: the columns, the view, the table, the bucket and its policies are there, and every
# function is replaced as it was, with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_change_orders_from_messages/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_change_orders_from_messages PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-change-orders-from-messages bed ok"
