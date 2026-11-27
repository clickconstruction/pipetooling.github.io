#!/usr/bin/env bash
# Runs supabase/tests/ready_to_bill_notice_zz against a throwaway copy of the WHOLE schema (punch list #443, row 7's
# walk: a ZZ test job sends no Ready to bill notice).
#
#   npm run test:pg:ready-to-bill-notice-zz
#
# The same bed as scripts/pgtest-lien-notice-record-delete.sh: the Supabase Postgres image migrated through
# pgtest_migrate (every file in supabase/migrations in order, or in CI the leg's migrated copy), then the row's
# migration a second time, which must change nothing: the function's definition, comment, owner and grants are read
# before and after and must be the same. The scenario plays the moves of a job into ready_to_bill inside one
# transaction that rolls back: a dev moves real jobs and ZZ test jobs there from Working and from Billed through
# update_job_status, and by a direct update under RLS; each real job queues one paid_job_email_queue row of kind
# ready_to_bill a move, as before, and no ZZ test job queues any, whether ZZ starts its own name, its stored customer
# name alone, or its name in lower case after a space; a move out of ready_to_bill, a move between two other statuses
# and an update that leaves the status where it is queue nothing; a job renamed in the same update as its move is
# read as it stands after the update; a ZZ test job that reaches Paid still queues its paid_in_full row. It raises on
# its first failed assertion and ends with "ready_to_bill_notice_zz PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a
# ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55710}"
NAME="pgtest-ready-to-bill-notice-zz"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_ready_to_bill_notice_leaves_zz_out.sql)"

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
# The function as the database holds it: its definition, its comment, its owner and its grants, as one line of hashes.
fn_state() {
  psql_as postgres -At -c "SELECT md5(pg_get_functiondef(p.oid)) || ' ' || md5(coalesce(obj_description(p.oid, 'pg_proc'), '')) || ' ' || p.proowner::regrole::text || ' ' || md5(coalesce(p.proacl::text, '')) FROM pg_proc p WHERE p.oid = 'public.enqueue_ready_to_bill_notification()'::regprocedure"
}

pgtest_migrate
# A second run must change nothing: the function is CREATE OR REPLACE and its comment is set again to the same words.
before="$(fn_state 2>"$ERR")" || { echo "FAILED reading enqueue_ready_to_bill_notification before the second run"; head -20 "$ERR"; exit 1; }
[ -n "$before" ] || { echo "FAILED: enqueue_ready_to_bill_notification is not there before the second run"; exit 1; }
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
after="$(fn_state 2>"$ERR")" || { echo "FAILED reading enqueue_ready_to_bill_notification after the second run"; head -20 "$ERR"; exit 1; }
[ "$before" = "$after" ] || { echo "FAILED: the second run changed the function"; echo "before: $before"; echo "after:  $after"; exit 1; }
echo "ok: the migration applied a second time changed nothing"
for scenario in supabase/tests/ready_to_bill_notice_zz/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "ready_to_bill_notice_zz PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "ready-to-bill-notice-zz bed ok"
