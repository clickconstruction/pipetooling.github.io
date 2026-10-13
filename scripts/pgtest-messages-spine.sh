#!/usr/bin/env bash
# Runs supabase/tests/messages_spine against a throwaway copy of the WHOLE schema (Messages, cut 1, the spine: contacts,
# their numbers and addresses, their jobs, the messages, Who is this?, and merge_customers keeping a thread).
#
#   npm run test:pg:messages-spine
#
# The same bed as scripts/pgtest-gc-customer-contacts.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The spine's migration is applied a second time right after its
# first, which must change nothing. The scenario, inside one transaction that rolls back: the seed makes one contact per person the
# app already has, and nothing the second time; only the office team reads; a number finds its person by its key, and
# a number two people share lands on the newest line's; Who is this? re-points a contact or folds it into the one
# already there, keeping the thread and a STOP; a company's row holds its own person and others by name; a line is tied
# to a job and the star moves; training mode and a digital twin change nothing; deleting a customer contact person or a
# roster person keeps their thread; merging two customers keeps both threads on the survivor; and a record with a
# contact is not deleted from under it. It raises on its first failed assertion and ends with "messages_spine PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR
# that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55475}"
NAME="pgtest-messages-spine"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
SPINE="$(ls supabase/migrations/*_messages_spine.sql)"
TECH="$(ls supabase/migrations/*_messages_tech_door.sql)"

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
  # A second run must change nothing: the tables, their indexes, policies and grants, the functions and the triggers are
  # there, and the seed finds nobody new. It runs right after the first, as a retried push would. Its grants start with
  # a REVOKE on its tables, which also takes back the column grants a later cut gives on them (Follow up's on contacts
  # and messages), so a second run after every later migration would build a schema prod never has.
  if [ "$f" = "$SPINE" ] || [ "$f" = "$TECH" ]; then
    psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  fi
done
out="$(psql_as postgres -f - < supabase/tests/messages_spine/20_scenario.sql 2>&1 || true)"
if ! grep -q "messages_spine PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
# R5's tech door (*_messages_tech_door): who reads a customer's thread from Job Mode, the office's wait and hours, a
# hold's end, an office-only note and a push named by its line. Its migration runs twice above, as the spine's does.
out="$(psql_as postgres -f - < supabase/tests/messages_spine/30_tech_door.sql 2>&1 || true)"
if ! grep -q "messages_tech_door PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "messages-spine bed ok"
