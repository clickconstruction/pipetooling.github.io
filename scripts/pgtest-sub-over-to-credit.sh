#!/usr/bin/env bash
# Runs supabase/tests/sub_over_to_credit against a throwaway copy of the WHOLE schema (a sheet paid past its total
# becomes a credit, punch list #347's residue).
#
#   npm run test:pg:sub-over-to-credit
#
# The same bed as scripts/pgtest-job-note-tags.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then this migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: an estimator is refused; each refusal names its reason and changes
# nothing; the press on a ticked, matched payment leaves less on the sheet, keeps the rest as the sub's credit with
# that payment, and leaves the tick and the bank match as they were made; a second press is refused; an unticked
# payment stays unticked and unmatched; and the kept credit still counts against the bank line. It raises on its
# first failed assertion and ends with "sub_over_to_credit PASSED". PGTEST_KEEP=1 leaves the container up. Needs
# docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55798}"
NAME="pgtest-sub-over-to-credit"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_sub_overpayment_to_credit.sql)"

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
# A second run must change nothing: one function replaced with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/sub_over_to_credit/20_scenario.sql 2>&1 || true)"
if ! grep -q "sub_over_to_credit PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "sub-over-to-credit bed ok"
