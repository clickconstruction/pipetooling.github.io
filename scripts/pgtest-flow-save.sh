#!/usr/bin/env bash
# Runs supabase/tests/flow_save against a throwaway copy of the WHOLE schema (Messages, cut 4's follow-ups: Settings →
# Flows' Save in one transaction, Remind now letting a standing hold go, and the money team pricing a draft change order).
#
#   npm run test:pg:flow-save
#
# The same bed as scripts/pgtest-messages-flows.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). This migration is then applied a second time, which must change nothing, and it
# stays last, so its nudge_record_sent is the one read. The scenario, inside one transaction that rolls back: Rosa saves
# a rename, a new step and a removed one, with History and Removed keeping who and a step left alone keeping its clock;
# a Save from the flow as it was before another's is refused; a Save that fails part way changes nothing; a step comes
# back from Removed; a superintendent, a training account, a twin and someone signed out are refused; the money team
# prices the office's draft and sends it, and the office's price and a price after it went are refused in words; Remind
# now lets the hold on its job go and leaves a hold on another job. It raises on its first failed assertion and ends
# with "flow_save PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55482}"
NAME="pgtest-flow-save"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_flow_save_remind_price.sql)"

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
# A second run must change nothing: every function is replaced as it was, with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/flow_save/20_scenario.sql 2>&1 || true)"
if ! grep -q "flow_save PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "flow-save bed ok"
