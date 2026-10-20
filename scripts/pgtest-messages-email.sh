#!/usr/bin/env bash
# Runs supabase/tests/messages_email against a throwaway copy of the WHOLE schema (Messages, cut 6, email in: an email's
# Gmail id on its line, the files and links on a line, the contact an address lands on, the reader's one write, its
# place and health, the files' bucket and the switch).
#
#   npm run test:pg:messages-email
#
# The same bed as scripts/pgtest-quo-messages.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The email migration is applied a second time right after its first, which must
# change nothing. The scenario, inside one transaction that rolls back: an email the reader takes twice is one line; its
# files and links keep their rules; a forwarded copy's note is a team note on the same thread; an address finds its
# person by its key, and a new address makes one unknown contact however many emails arrive at once; the office reads
# the lines' files, the reader's state and the bucket, answers a paper offer, stamped with who and when, and writes
# nothing else; training mode and a digital twin answer nothing; nobody signed in reaches the reader's functions; the
# switch ships off. It raises on its first failed assertion and ends with "messages_email PASSED". Then residential R6's
# two boxes (*_messages_two_boxes), also applied twice: lines from before it (25_two_boxes_before.sql, run just before
# it) take their box, and 30_two_boxes.sql ends with "messages_two_boxes PASSED". Then one email in both boxes
# (*_messages_rfc_message_id), also applied twice: 40_message_id.sql ends with "messages_message_id PASSED". PGTEST_KEEP=1
# leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR that touches a
# migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55491}"
NAME="pgtest-messages-email"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
EMAIL="$(ls supabase/migrations/*_messages_email_in.sql)"
BOXES="$(ls supabase/migrations/*_messages_two_boxes.sql)"
MESSAGE_ID="$(ls supabase/migrations/*_messages_rfc_message_id.sql)"

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
  # The lines from before two boxes, for R6's backfill.
  if [ "$f" = "$BOXES" ]; then
    psql_as postgres -f - < supabase/tests/messages_email/25_two_boxes_before.sql >/dev/null 2>"$ERR" || { echo "FAILED seeding before $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  fi
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  # A second run must change nothing: the columns, the index, the constraints, the tables, the functions, the bucket,
  # the switch and the cron are there. It runs right after the first, as a retried push would: its grants start with a
  # REVOKE on its own tables, so a second run after a later cut's migration would take back what that cut granted.
  if [ "$f" = "$EMAIL" ] || [ "$f" = "$BOXES" ] || [ "$f" = "$MESSAGE_ID" ]; then
    psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  fi
done
out="$(psql_as postgres -f - < supabase/tests/messages_email/20_scenario.sql 2>&1 || true)"
if ! grep -q "messages_email PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/messages_email/30_two_boxes.sql 2>&1 || true)"
if ! grep -q "messages_two_boxes PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/messages_email/40_message_id.sql 2>&1 || true)"
if ! grep -q "messages_message_id PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "messages-email bed ok"
