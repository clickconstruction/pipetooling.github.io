#!/usr/bin/env bash
# Runs supabase/tests/dev_clock_session_write against a throwaway copy of the WHOLE schema (v2.4957, the Building
# lane's U3a-i; every Building press since).
#
#   bash scripts/pgtest-dev-clock-session-write.sh
#
# The same bed as scripts/pgtest-gc-schedule.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). Building's presses (PRESSES below) are then
# applied a second time, which must change nothing. Each file in supabase/tests/dev_clock_session_write plays one
# press's scenario through RLS as a dev, a trainee, a twin and a role outside Building's dev door, inside
# one transaction that rolls back. Each raises on its first failed assertion and ends with
# "dev_clock_session_write PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; .github/workflows/sql-beds.yml
# runs it on a PR that touches Building's SQL. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55447}"
NAME="pgtest-dev-clock-session-write"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The door, applied a second time below.
PRESSES=(
  supabase/migrations/*_dev_clock_session_write.sql
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
# A second run must change nothing: each press's functions are replaced as they were.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/dev_clock_session_write/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "dev_clock_session_write PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "dev-clock-session-write bed ok"
