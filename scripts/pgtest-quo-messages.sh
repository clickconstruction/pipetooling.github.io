#!/usr/bin/env bash
# Runs supabase/tests/quo_messages against a throwaway copy of the WHOLE schema (Messages, cut 5, the Quo link: what a
# call or a text from Quo carries on a messages line, the webhook's one write, and its memory of the deliveries it took).
#
#   npm run test:pg:quo-messages
#
# The same bed as scripts/pgtest-messages-spine.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute), the Quo migration a second time right after its first, which must change nothing
# (the later migrations win: v2.5549's roster read of quo_place_number). The scenario, inside one transaction that rolls back: a text Quo sends twice is one line; quo_write_line writes over the
# revision it read and refuses a stale one, so two events for one call never write over each other; the new columns
# keep their rules; the webhook takes a delivery once, gives one back, takes an id past 28 hours again and forgets the
# old ones; the office reads the new columns and writes none of them; nobody signed in reaches the memory or the
# functions. It raises on its first failed assertion and ends with "quo_messages PASSED". PGTEST_KEEP=1 leaves the
# container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR that touches a migration.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55476}"
NAME="pgtest-quo-messages"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
QUO="$(ls supabase/migrations/*_quo_messages.sql)"

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
  # A second run must change nothing: the columns, the index, the constraints, the table and the functions are there.
  # Right after the first, so the migrations after it (v2.5549's quo_place_number) still win.
  if [ "$f" = "$QUO" ]; then
    psql_as postgres -f - < "$QUO" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $QUO"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  fi
done
out="$(psql_as postgres -f - < supabase/tests/quo_messages/20_scenario.sql 2>&1 || true)"
if ! grep -q "quo_messages PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "quo-messages bed ok"
