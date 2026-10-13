#!/usr/bin/env bash
# Runs supabase/tests/messages_notify_cron against a throwaway copy of the WHOLE schema (Messages, residential R5's
# push, PR 3: the owner's switch and the minute cron that posts the sweep to messages-notify).
#
#   npm run test:pg:messages-notify-cron
#
# The same bed as scripts/pgtest-messages-spine.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The cron's migration is applied a second time right after its first, which must
# leave one cron row and the switch as it was. The scenario, inside one transaction that rolls back: the switch ships
# off; one cron row runs every minute, posting the sweep to messages-notify with the cron secret, and selects nothing
# to post while the switch is off; only the owner or a dev turns it on or off. It raises on its first failed assertion
# and ends with "messages_notify_cron PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds
# workflow runs it from scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55485}"
NAME="pgtest-messages-notify-cron"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
CRON="$(ls supabase/migrations/*_messages_notify_cron.sql)"

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
  # A second run must change nothing: one cron row, the switch as it was, the policy there. It runs right after the
  # first, as a retried push would.
  if [ "$f" = "$CRON" ]; then
    psql_as postgres -f - < "$CRON" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $CRON"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  fi
done
out="$(psql_as postgres -f - < supabase/tests/messages_notify_cron/20_scenario.sql 2>&1 || true)"
if ! grep -q "messages_notify_cron PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "messages-notify-cron bed ok"
