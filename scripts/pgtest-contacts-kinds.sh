#!/usr/bin/env bash
# Runs supabase/tests/contacts_kinds against a throwaway copy of the WHOLE schema (Messages, residential R0's SQL: seven
# kinds of contact, migration *_contacts_seven_kinds).
#
#   npm run test:pg:contacts-kinds
#
# The same bed as scripts/pgtest-messages-spine.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). R0's migration is applied a second time right after its first, which must change
# nothing. The scenario, inside one transaction that rolls back: the seeds give the roster's subs, a supply house's
# counter and its reps a contact each, once; a row says one kind on its own record; Who is this? names a lead with no
# record, points a lead at its Prospects row, re-points a lead who books to the customer, names a candidate, a sub, a
# rep and a second person at a supply house, and refuses a record of another kind; Follow up's badge leaves out supply
# houses and candidates; a candidate reads only to a dev and the hiring board; deleting a Prospects row, a candidate, a
# rep or a supply house keeps every thread; and a roster person's contact follows the roster's kind. It raises on its
# first failed assertion and ends with "contacts_kinds PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the
# SQL beds workflow runs it from scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55484}"
NAME="pgtest-contacts-kinds"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
KINDS="$(ls supabase/migrations/*_contacts_seven_kinds.sql)"

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
  # A second run must change nothing: the columns, indexes, checks, policies, functions and triggers are there, and the
  # seeds find nobody new. It runs right after the first, as a retried push would.
  if [ "$f" = "$KINDS" ]; then
    psql_as postgres -f - < "$KINDS" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $KINDS"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  fi
done
out="$(psql_as postgres -f - < supabase/tests/contacts_kinds/20_scenario.sql 2>&1 || true)"
if ! grep -q "contacts_kinds PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "contacts-kinds bed ok"
