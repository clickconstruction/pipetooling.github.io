#!/usr/bin/env bash
# Runs supabase/tests/typed_hours against a throwaway Postgres (v2.4242; the assistant hours window fence rides along, v2.4271).
#
#   npm run test:pg:typed-hours
#
# The bed is a stand-in schema (00_schema.sql), then the typed_hours_second_look migration as
# it ships, then the scenarios (20_scenarios.sql), which raise on the first failed assertion and
# end with a "… PASSED" notice. Never touches prod.
#
# Two ways to get the Postgres:
#   * Docker (default), as pgtest-pay-sources.sh does;
#   * PGTEST_PGBIN=/path/to/postgres/bin — a local install's initdb / pg_ctl, for a machine
#     without Docker (brew: /usr/local/opt/postgresql@15/bin).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55433}"
NAME="pgtest-typed-hours"
BED="supabase/tests/typed_hours"
MIGRATIONS=(supabase/migrations/20260930160727_typed_hours_second_look.sql supabase/migrations/20260930210418_assistant_hours_window_fence.sql)
TMP="$(mktemp -d)"

command -v psql >/dev/null || { echo "psql not on PATH"; exit 2; }

if [ -n "${PGTEST_PGBIN:-}" ]; then
  export LC_ALL=C  # macOS: a postmaster started without a locale "became multithreaded during startup"
  "$PGTEST_PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust --locale=C >/dev/null
  "$PGTEST_PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -c listen_addresses=localhost -c unix_socket_directories=" -l "$TMP/log" -w start >/dev/null
  trap '"$PGTEST_PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1; rm -rf "$TMP"' EXIT
else
  command -v docker >/dev/null || { echo "docker not on PATH (or set PGTEST_PGBIN)"; exit 2; }
  docker info >/dev/null 2>&1 || { echo "docker is not running (or set PGTEST_PGBIN)"; exit 2; }
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" postgres:15 >/dev/null
  trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
  export PGPASSWORD=pg
fi
for _ in $(seq 1 60); do pg_isready -h localhost -p "$PORT" -U postgres >/dev/null 2>&1 && break; sleep 1; done
PSQL=(psql -h localhost -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;" >/dev/null
"${PSQL[@]}" -f "$BED/00_schema.sql"
for m in "${MIGRATIONS[@]}"; do "${PSQL[@]}" -f "$m" 2>&1 | grep -v "does not exist, skipping" || true; done
fail=0
for s in "$BED"/[2-9]*_*.sql; do
  out="$("${PSQL[@]}" -f "$s" 2>&1)" || fail=1
  echo "$out" | grep -E "PASSED|ERROR|FAILED|CONTEXT|WARNING" || true
done
[ "$fail" = 0 ] || { echo "typed_hours bed FAILED"; exit 1; }
echo "bed ok"
