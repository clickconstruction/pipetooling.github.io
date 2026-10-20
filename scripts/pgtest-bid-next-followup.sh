#!/usr/bin/env bash
# Runs supabase/tests/bid_next_followup against a throwaway copy of the WHOLE schema (v2.4419, v2.4427).
#
#   npm run test:pg:bid-next-followup
#
# The same bed as scripts/pgtest-combined-copies.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The scenario logs contacts on a bid as an
# estimator, through RLS, inside one transaction that rolls back: a day set, kept, moved, removed
# and brought back, and what is refused. It raises on its first failed assertion and ends with
# "bid_next_followup PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55438}"
NAME="pgtest-bid-next-followup"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
MIGRATION="supabase/migrations/20261002150000_bid_next_followup.sql"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
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
done
# A second run of each migration must change nothing.
psql_as postgres -f - < "$MIGRATION" >/dev/null 2>&1
psql_as postgres -f - < supabase/migrations/20261002160000_bid_followup_reminders.sql >/dev/null 2>"$ERR" || { echo "FAILED re-applying the reminders migration"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
for bed in bid_next_followup; do
  out="$(psql_as postgres -f - < "supabase/tests/$bed/20_scenario.sql" 2>&1 || true)"
  if ! grep -q "${bed} PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "bid-next-followup bed ok"
