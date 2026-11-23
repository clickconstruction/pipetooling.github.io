#!/usr/bin/env bash
# Runs supabase/tests/stripe_paid_day against a throwaway copy of the WHOLE schema (Bills sent, punch list #422,
# PR 2: a Stripe payment is filed on the company's day, not the UTC clock's).
#
#   npm run test:pg:stripe-paid-day
#
# The same bed as scripts/pgtest-primary-paid-verbs.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then this migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back, calls mark_invoice_paid_from_stripe as stripe-webhook does: with no day for
# a customer's own payment (the row takes app_today()), twice for Stripe's two events (one row), and with a day for
# a bill marked paid outside Stripe (the day named stands). It also reads the function's own body, so the bed fails
# at any hour if the UTC day comes back. It raises on its first failed assertion and ends with
# "stripe_paid_day PASSED".
#
# Then the older rows (v2.8371, *_stripe_paid_day_older_rows): 30_older_rows.sql seeds rows the way the old function
# wrote them, and rows that differ from them in one mark each; the correction runs as db push runs it and must move
# the three late rows back a day and nothing else; a second run must move nothing; and seven more late rows than the
# six read on prod must be refused whole. PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow
# runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55910}"
NAME="pgtest-stripe-paid-day"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_stripe_paid_day_is_the_company_day.sql)"
ROWS="$(ls supabase/migrations/*_stripe_paid_day_older_rows.sql)"
OLDER=supabase/tests/stripe_paid_day/30_older_rows.sql

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
# A second run must change nothing: CREATE OR REPLACE.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/stripe_paid_day/20_scenario.sql 2>&1 || true)"
if ! grep -q "stripe_paid_day PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"

# The older rows. One phase of 30_older_rows.sql, named by a psql variable; it must print its closing word.
older() {
  local o
  o="$(psql_as postgres -v "$1=" -f - < "$OLDER" 2>&1 || true)"
  if ! grep -q "$2" <<<"$o"; then echo "FAILED in the $1 phase"; echo "$o" | tail -30; exit 1; fi
  grep -o "ok: .*" <<<"$o" || true
}
# The correction as db push runs it; prints what it said it moved.
correct() { psql_as postgres -f - < "$ROWS" 2>&1 >/dev/null; }

older seed "older_rows seeded"
said="$(correct)" || { echo "FAILED running $ROWS"; echo "$said" | tail -20; exit 1; }
grep -q "3 Stripe payment row(s) moved" <<<"$said" || { echo "FAILED: the correction did not say it moved three"; echo "$said"; exit 1; }
echo "ok: the correction says it moved three rows"
older check "older_rows check PASSED"
said="$(correct)" || { echo "FAILED running $ROWS a second time"; echo "$said" | tail -20; exit 1; }
grep -q "0 Stripe payment row(s) moved" <<<"$said" || { echo "FAILED: a second run moved something"; echo "$said"; exit 1; }
echo "ok: a second run moves nothing"
older check "older_rows check PASSED"
older crowd "older_rows crowd seeded"
if said="$(correct)"; then echo "FAILED: the correction moved more rows than were read"; echo "$said"; exit 1; fi
grep -q "more than the six read" <<<"$said" || { echo "FAILED: the correction stopped for another reason"; echo "$said" | tail -20; exit 1; }
echo "ok: more late rows than were read are refused"
older crowded "older_rows crowded PASSED"
echo "stripe-paid-day bed ok"
