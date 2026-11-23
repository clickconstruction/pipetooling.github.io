#!/usr/bin/env bash
# Runs supabase/tests/start_checks against a throwaway copy of the WHOLE schema (Before we start, punch list #382:
# the eight tables, who reads them, and the one door for Go and Hold).
#
#   npm run test:pg:start-checks
#
# The same bed as scripts/pgtest-trips.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then its migration a second time, which must change nothing. The scenario, inside one
# transaction that rolls back: the eight tables carry their fences and the grants written; the office writes a
# stage's bullets, a yes, an ask and a day they gave, and each table refuses what it should in its own words; Go and
# Hold through start_check_decide, with the name kept and a Hold moving our window; the Go taken back; who may not
# decide, with a training account, a twin and someone who left refused by the function itself; who reads what (the
# office's four roles, a primary and an estimator with and without a claim, a superintendent on and off the job,
# the crew, and a primary on the crew); the company's lists and the settings; a stage line carrying its list to
# another job; and what goes with a line, a job and a site. It raises on its first failed assertion and ends with
# "start_checks PASSED". Then 30_arrive.sql, the crew's look on arrival (migrations *_start_check_arrive,
# *_start_check_arrive_once and *_start_check_arrive_again): which stage is asked about, the answer kept as a yes we
# saw, a No opening its bullet and sending Dispatch one line, a second yes that cannot replace a No, a later No kept,
# a bullet with a No asked about again once it has a new yes, the card's answer marking only the bullets it showed
# (*_start_check_arrive_shown), and who the two functions refuse; it ends with "start_check_arrive PASSED". PGTEST_KEEP=1 leaves the
# container up.
# Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55882}"
NAME="pgtest-start-checks"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_start_checks.sql supabase/migrations/*_start_check_arrive.sql supabase/migrations/*_start_check_arrive_once.sql supabase/migrations/*_start_check_arrive_again.sql supabase/migrations/*_start_check_arrive_shown.sql)"

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
# A second run must change nothing: the tables and their indexes left alone, the policies and triggers remade, the
# functions replaced with the same grants. The tables' file puts the first crew gate back, so the file that replaced
# it ends in _start_checks.sql too (*_crew_days_start_checks.sql): the list above catches it and applies it after.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/start_checks/20_scenario.sql 2>&1 || true)"
if ! grep -q "start_checks PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
# On arrival (PR 10, migration *_start_check_arrive): what the crew is asked, the answer kept, a No sent to Dispatch.
out="$(psql_as postgres -f - < supabase/tests/start_checks/30_arrive.sql 2>&1 || true)"
if ! grep -q "start_check_arrive PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "start_checks bed ok"
