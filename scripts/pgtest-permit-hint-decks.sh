#!/usr/bin/env bash
# Runs supabase/tests/permit_hint_decks against a throwaway copy of the WHOLE schema (v2.6917, punch list #302 call 4:
# the hint beside a permit's name sees a lead on either calling deck; migration *_permit_hint_both_decks).
#
#   npm run test:pg:permit-hint-decks
#
# The Supabase Postgres image with every file in supabase/migrations applied in order, then this migration a second
# time, which must change nothing. The probe, inside one transaction that rolls back: research_contact_history says
# "on the deck" for an open lead on Jobs to GC and for one on the Customers deck, and for no sub, no lead that left
# the queue and no name nobody holds; the bids and the wins read as before; one row comes back per distinct name
# asked; and the office reads the same answer through its own access. It raises on its first failed assertion and
# ends with "permit_hint_decks PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow
# runs it from scripts/sql-beds.txt. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55597}"
NAME="pgtest-permit-hint-decks"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_permit_hint_both_decks.sql)"

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
# A second run must change nothing: the function is replaced with the body it already has.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/permit_hint_decks/20_scenario.sql 2>&1 || true)"
if ! grep -q "permit_hint_decks PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "permit-hint-decks bed ok"
