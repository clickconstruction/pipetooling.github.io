#!/usr/bin/env bash
# Runs supabase/tests/bill_lines_sweep against a throwaway copy of the WHOLE schema (v2.6882, punch list #298 PR 2: the
# sweep that reads the supply house bills on file; migration *_bill_lines_sweep).
#
#   npm run test:pg:bill-lines-sweep
#
# The same bed as scripts/pgtest-counter-tickets.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The probe, inside one transaction that
# rolls back: the holds table carries the fences, the office reads a hold and writes none, a helper reads none; a bill
# takes one paper and a second is refused while a paper with no bill is not; a hold goes with its bill; a read is the
# form's unless it says the sweep's; the switch is on; the cron is one row. It raises on its first failed assertion and
# ends with "bill_lines_sweep PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it
# from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55582}"
NAME="pgtest-bill-lines-sweep"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_bill_lines_sweep.sql)"

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
# A second run must change nothing: the table stands, the columns and the index are there, the cron is one row.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/bill_lines_sweep/20_scenario.sql 2>&1 || true)"
if ! grep -q "bill_lines_sweep PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "bill-lines-sweep bed ok"
