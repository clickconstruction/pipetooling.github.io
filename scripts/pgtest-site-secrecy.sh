#!/usr/bin/env bash
# Runs supabase/tests/site_secrecy against a throwaway copy of the WHOLE schema (punch list #439, piece 4, the ground:
# secrecy on a site).
#
#   npm run test:pg:site-secrecy
#
# The same bed as scripts/pgtest-job-papers-lock.sh: the Supabase Postgres image migrated through pgtest_migrate (every
# file in supabase/migrations in order, or in CI the leg's migrated copy), then the site's migration a second time,
# which must change nothing. The scenario, inside one transaction that rolls back: address_key writes the app's key for
# every address of a list the app's own test reads; a job whose rows name no site is told by every one of the gate's
# questions what the rule of before tells it, for the office, a master, a lead, a helper, a sub and an estimator;
# only the office looks at what a press would reach or presses; turning secrecy on for a development puts the site's
# paper on each of its jobs and on no other; a person who has not signed is shut out of every job of the site and the
# office keeps its reads; a sub with a login is not asked and is not shut out, and still owes a job's own paper; one
# signature opens every job of the site to that person alone, with one copy; Needs you and the roster read the same; a
# site's paper is not taken off one job; a new job at a site that is on gets its row by the trigger, a job moved away
# loses it, and one moved back gets the same row again; an address is a site by its key, by a Same place answer and by
# a changed address; a job that requires the same paper by itself keeps its own row; turning off opens the jobs and
# keeps the signatures; turning on again brings the same site back and asks only those who never signed; and a
# helper's plain read of jobs asks the fence once, in an InitPlan, and never works out an address key. It raises on
# its first failed assertion and ends with "site_secrecy PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker;
# the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55440}"
NAME="pgtest-site-secrecy"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_site_secrecy.sql)"

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
# A second run must change nothing: the table, its indexes and the column are there, the policy and the two triggers
# are remade, and every function is replaced by itself with the grants it had.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/site_secrecy/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "site_secrecy PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "site-secrecy bed ok"
