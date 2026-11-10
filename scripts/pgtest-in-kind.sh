#!/usr/bin/env bash
# Runs supabase/tests/in_kind against a throwaway copy of the WHOLE schema (v2.6827, punch list #301 PR 1: one place
# for work paid in kind; migration *_in_kind_arrangements).
#
#   npm run test:pg:in-kind
#
# The same bed as scripts/pgtest-away-notes.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The probe, inside one transaction that
# rolls back: the three tables carry the fences and the functions are closed to anon; only the office makes a deal, and
# never in another person's name; a deal pays only its own customer's jobs; a helper, a primary and an office person in
# training read and write nothing; a line needs a memo, a date that has come and an amount; the dry run writes nothing;
# a line lands on the oldest open bills as In kind payments that each say their part, a bill on Stripe is passed over
# and named, a job billed with no bill row is paid on the job, and what finds no bill is said; a month takes one line
# and a line of zero settles a month; a line moves between a job and overhead; taking a line back reopens its bills and
# keeps the row; an ended deal lets its jobs go; an empty deal is deleted. Then 30_pay_speed.sql (v2.6834, migration
# *_in_kind_leaves_pay_speed): an In kind payment gets its pay_speed_exclusions row and the sampler skips it. Each
# raises on its first failed assertion and ends with its own PASSED line. PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55581}"
NAME="pgtest-in-kind"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_in_kind_arrangements.sql supabase/migrations/*_in_kind_leaves_pay_speed.sql)"

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
# A second run must change nothing: the tables stand, the policies, triggers and functions are remade the same.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/in_kind/20_scenario.sql 2>&1 || true)"
if ! grep -q "in_kind PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/in_kind/30_pay_speed.sql 2>&1 || true)"
if ! grep -q "in_kind_pay_speed PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "in-kind bed ok"
