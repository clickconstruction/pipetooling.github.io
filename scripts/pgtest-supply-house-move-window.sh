#!/usr/bin/env bash
# Runs supabase/tests/supply_house_move_window against a throwaway Postgres (v2.5723).
#
#   npm run test:pg:supply-house-move-window
#
# The bed is a stand-in schema (00_schema.sql), then the migration as it ships
# (20261021220000_count_supply_house_move_window.sql), twice because it must re-run cleanly, then
# the scenarios (20_scenarios.sql), which raise on the first failed assertion and end with a
# "… PASSED" notice. The scenario's $rows$ and $expect$ blocks are also read by
# src/lib/supplyHouseMoveWindow.parity.test.ts, which holds the tab's kernel to the same numbers.
# Never touches prod.
#
# Two ways to get the Postgres:
#   * Docker (default): postgres:17, prod's major version (17.6);
#   * PGTEST_PGBIN=/path/to/postgres/bin — a local install's initdb / pg_ctl, for a machine
#     without Docker (brew: /usr/local/opt/postgresql@18/bin).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55448}"
NAME="pgtest-supply-house-move-window"
BED="supabase/tests/supply_house_move_window"
NEWEST="supabase/migrations/20261021220000_count_supply_house_move_window.sql"
MIGRATIONS=("$NEWEST" "$NEWEST")
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
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" postgres:17 >/dev/null
  trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
  export PGPASSWORD=pg
fi
for _ in $(seq 1 60); do pg_isready -h localhost -p "$PORT" -U postgres >/dev/null 2>&1 && break; sleep 1; done
PSQL=(psql -h localhost -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;" >/dev/null
"${PSQL[@]}" -f "$BED/00_schema.sql" >/dev/null
for m in "${MIGRATIONS[@]}"; do
  out="$("${PSQL[@]}" -f "$m" 2>&1)" || { echo "FAILED applying $m"; echo "$out" | tail -20; exit 1; }
done
out="$("${PSQL[@]}" -f "$BED/20_scenarios.sql" 2>&1)" || { echo "$out" | grep -E "FAILED|ERROR|CONTEXT" | head -20; echo "supply_house_move_window bed FAILED"; exit 1; }
grep -q "supply_house_move_window scenarios PASSED" <<<"$out" || { echo "$out" | tail -20; echo "supply_house_move_window bed FAILED"; exit 1; }
echo "supply-house-move-window bed ok"
