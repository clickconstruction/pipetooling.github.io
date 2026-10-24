#!/usr/bin/env bash
# Runs supabase/tests/email_box_count against a throwaway copy of the WHOLE schema (Quickfill's Email station, punch
# list #159: the counted boxes, who sees whose inbox facts, who may change the list).
#
#   npm run test:pg:email-box-count
#
# The same bed as scripts/pgtest-messages-email.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The count's migration is applied a second time right after its first, which must
# change nothing. The scenario, inside one transaction that rolls back: a shared box shows to the office team and a
# person's box to that person and to the lead the owner names, nobody else; the owner and a dev read and change the
# list; a person changes their own labels and switch and nothing else; only the count writes how a box is doing; a
# switch turned off or a label dropped takes the named rows with it; training mode changes nothing; nobody signed in
# reaches anything; the switch ships off and the cron posts nothing while it is off. It raises on its first failed
# assertion and ends with "email_box_count PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds
# workflow runs it from scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55533}"
NAME="pgtest-email-box-count"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
COUNT="$(ls supabase/migrations/*_email_box_count.sql)"

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
  # A second run must change nothing: the tables, the triggers, the function, the policies, the settings and the cron
  # are there. It runs right after the first, as a retried push would.
  if [ "$f" = "$COUNT" ]; then
    psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  fi
done
out="$(psql_as postgres -f - < supabase/tests/email_box_count/20_scenario.sql 2>&1 || true)"
if ! grep -q "email_box_count PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "email-box-count bed ok"
