#!/usr/bin/env bash
# Runs supabase/tests/permit_policies against a throwaway copy of the WHOLE schema (v2.6894, punch list #292: the
# access rule on the Permits tables read once per statement; migration *_permit_policies_once).
#
#   npm run test:pg:permit-policies
#
# The Supabase Postgres image with every file in supabase/migrations applied in order, then this migration a second
# time, which must change nothing. The probe, inside one transaction that rolls back: every policy on the Permits
# tables names user_can_research_permits() inside a scalar subquery and none is left bare; the row's own test stands
# beside the rule on each write; an estimator reads the permits, verdicts, pulls, builders and marks, answers in their
# own name only, marks a builder, and inserts a dropped file's row and no other; the planner runs the rule as an
# InitPlan; a helper reads and writes nothing; anon is refused. It raises on its first failed assertion and ends with
# "permit_policies PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55594}"
NAME="pgtest-permit-policies"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_permit_policies_once.sql)"

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
# A second run must change nothing: each policy is altered to the form it already has.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/permit_policies/20_scenario.sql 2>&1 || true)"
if ! grep -q "permit_policies PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "permit-policies bed ok"
