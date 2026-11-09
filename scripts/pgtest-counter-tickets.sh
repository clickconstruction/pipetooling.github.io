#!/usr/bin/env bash
# Runs supabase/tests/counter_tickets against a throwaway copy of the WHOLE schema (v2.6812, punch list #295 PR 1: a
# photo of the supply house ticket; migration *_counter_tickets).
#
#   npm run test:pg:counter-tickets
#
# The same bed as scripts/pgtest-away-notes.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The probe, inside one transaction that
# rolls back: both tables carry the fences, nobody deletes a ticket, the bucket is private and the photo-save cron is one
# row that names the ticket pages; a helper saves his own ticket and never another person's; he matches the charge on
# his own card and never one on another card; one live ticket a charge; the office reads every ticket, ties any charge
# and uses a ticket, after which its taker no longer moves or removes it; the holder of a card reads the ticket on his
# charge; a ticket moved to another job has its filed page marked to move; a match taken off clears whole. It raises on
# its first failed assertion and ends with "counter_tickets PASSED". PGTEST_KEEP=1 leaves the container up. Needs
# docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches
# prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55571}"
NAME="pgtest-counter-tickets"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_counter_tickets.sql)"

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

pgtest_migrate
# A second run must change nothing: the tables stand, the policies and triggers are remade the same, the cron is one row.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/counter_tickets/20_scenario.sql 2>&1 || true)"
if ! grep -q "counter_tickets PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "counter-tickets bed ok"
