#!/usr/bin/env bash
# Runs supabase/tests/card_charges_window against a throwaway Postgres (v2.4665).
#
#   npm run test:pg:card-charges-window
#
# The bed is a stand-in schema (00_schema.sql), then the three card-charges migrations as they
# ship: the read (20261005212106), the refunds (20261005235207) and the purchase time
# (20261006061356), the last one twice because it must re-run cleanly. Then the scenarios
# (20_scenarios.sql), which raise on the first failed assertion and end with a "… PASSED" notice.
# Never touches prod.
#
# Two ways to get the Postgres:
#   * Docker (default): postgres:17, prod's major version (17.6);
#   * PGTEST_PGBIN=/path/to/postgres/bin — a local install's initdb / pg_ctl, for a machine
#     without Docker (brew: /usr/local/opt/postgresql@15/bin; the schema stands in
#     pg_input_is_valid, which Postgres has from 16).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55447}"
NAME="pgtest-card-charges-window"
BED="supabase/tests/card_charges_window"
NEWEST="supabase/migrations/20261006061356_card_charges_window_purchased_at.sql"
MIGRATIONS=(supabase/migrations/20261005212106_card_charges_window.sql supabase/migrations/20261005235207_card_charges_window_refunds.sql "$NEWEST" "$NEWEST")
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
out="$("${PSQL[@]}" -f "$BED/20_scenarios.sql" 2>&1)" || { echo "$out" | grep -E "FAILED|ERROR|CONTEXT" | head -20; echo "card_charges_window bed FAILED"; exit 1; }
grep -q "card_charges_window scenarios PASSED" <<<"$out" || { echo "$out" | tail -20; echo "card_charges_window bed FAILED"; exit 1; }
echo "card-charges-window bed ok"
