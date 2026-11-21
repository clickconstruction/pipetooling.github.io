#!/usr/bin/env bash
# Runs supabase/tests/person_report_write_up against a throwaway copy of the WHOLE schema (v2.8157, punch list #410:
# write someone up, the ground under the phone sheet).
#
#   npm run test:pg:person-report-write-up
#
# The same bed as scripts/pgtest-person-file-amendments.sh: the Supabase Postgres image migrated through pgtest_migrate
# (every file in supabase/migrations in order, or in CI the leg's migrated copy), then the write-up migration a second
# time, which must change nothing. The scenario plays write_up_people, land_person_report and withdraw_person_report as
# a leader, a superintendent, a helper, the office and a leader in training mode, inside one transaction that rolls
# back: who gets the list and whose names carry a shared day; a send that lands with its facts worked out; a press that
# arrives twice; every refusal in words; an addition; a write-up taken back and kept. It raises on its first failed
# assertion and ends with "person_report_write_up PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55905}"
NAME="pgtest-person-report-write-up"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The write-up migration, applied a second time below.
PRESSES=(
  supabase/migrations/*_person_report_write_up.sql
)

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
# A second run must change nothing: the columns, the checks, the indexes and the functions are all made idempotent.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/person_report_write_up/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "person_report_write_up PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "person-report-write-up bed ok"
