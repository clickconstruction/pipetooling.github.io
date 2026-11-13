#!/usr/bin/env bash
# Runs supabase/tests/receipt_texts against a throwaway copy of the WHOLE schema (v2.7142, punch list #299 PR 2: the
# text when a charge posts; migration *_receipt_texts).
#
#   npm run test:pg:receipt-texts
#
# The same bed as scripts/pgtest-counter-tickets.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The probe, inside one transaction that
# rolls back: the switch ships off and the cron is one row that calls only when receipt_texts_due(); only the owner or
# a dev changes the switch; the day it went on is the database's clock whatever the write says, a write that leaves it
# on for the same people keeps that day, and a value that does not read lands as off; the guard is false while either
# switch is off, for a charge older than the switch or than 48 hours, for a pending charge, money back, a duplicate, a
# dead charge or one with its ticket, and true for a charge to ask, a request that waits, a reminder in its evening and
# a request whose charge the bank took back; a trial counts only its people. It raises on its first failed assertion
# and ends with "receipt_texts PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs
# it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod, and sends nothing: the bed
# has no function to call and no number to text.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55618}"
NAME="pgtest-receipt-texts"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_receipt_texts.sql)"

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
# A second run must change nothing: the columns stand, the switch keeps what it reads, the policy, the trigger and the
# guard are remade the same, the cron is one row.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/receipt_texts/20_scenario.sql 2>&1 || true)"
if ! grep -q "receipt_texts PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "receipt-texts bed ok"
