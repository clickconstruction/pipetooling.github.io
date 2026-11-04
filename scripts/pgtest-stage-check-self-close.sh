#!/usr/bin/env bash
# Runs supabase/tests/stage_check_self_close against a throwaway copy of the WHOLE schema (v2.6494, punch list #245
# PR 2a: a stage check sent to Dispatch closes itself when the check is settled; migration *_stage_check_self_close).
#
#   npm run test:pg:stage-check-self-close
#
# The same bed as scripts/pgtest-logbook-shares.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The scenario, inside one transaction
# that rolls back: a note saved alone leaves the request open; the crew's answer closes it in their name with the pick,
# while their own update of the request reaches no row; a second press after the close changes nothing; a new send on
# the same check after the close is allowed and a skip closes it with its reason; a job item taken off closes its own
# stage's request and a company question retired closes the request on every stage; a promote says so; Dispatch's own
# answer on the sheet closes the request in their name; and a plain request and a request on another check stay open
# throughout. It raises on its first failed assertion and ends with "stage_check_self_close PASSED". PGTEST_KEEP=1
# leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that
# touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55552}"
NAME="pgtest-stage-check-self-close"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_stage_check_self_close.sql)"

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
# A second run must change nothing: the five functions, the three triggers and the promote as restated.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/stage_check_self_close/20_scenario.sql 2>&1 || true)"
if ! grep -q "stage_check_self_close PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "stage-check-self-close bed ok"
