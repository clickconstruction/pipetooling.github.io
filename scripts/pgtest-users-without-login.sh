#!/usr/bin/env bash
# Runs supabase/tests/users_without_login against a throwaway Postgres (punch list #260, v2.6511).
#
#   bash scripts/pgtest-users-without-login.sh
#
# The bed is a stand-in schema (00_schema.sql: prod's auth.users / auth.identities columns, the baseline users
# with users_id_fkey, the auth triggers, clock_sessions, people, the roster view), then 10_before.sql (what the
# baseline does), then the import door's migration and 20261104190000_users_login_attached_at.sql — twice, since a
# migration is idempotent — then 20_scenarios.sql: a worker with no login, their days through import_clock_sessions,
# a login attached on the same id, taken away, attached again. Each file raises on its first failed assertion and
# ends with a "… PASSED" line. Never touches prod.
#
# Two ways to get the Postgres:
#   * Docker (default), as pgtest-typed-hours.sh does;
#   * PGTEST_PGBIN=/path/to/postgres/bin — a local install's initdb / pg_ctl, for a machine without Docker
#     (brew: /usr/local/opt/postgresql@15/bin).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55449}"
NAME="pgtest-users-without-login"
BED="supabase/tests/users_without_login"
MIGRATIONS=(supabase/migrations/20261103030000_imported_clock_sessions.sql supabase/migrations/20261104190000_users_login_attached_at.sql supabase/migrations/20261104200000_add_worker.sql supabase/migrations/20261104210000_people_without_users_backfill.sql supabase/migrations/20261104220000_notification_recipient_is_a_user.sql supabase/migrations/20261104230000_people_have_a_users_row.sql supabase/migrations/20261109110000_delete_fresh_person.sql supabase/migrations/20261109140000_delete_fresh_person_stints.sql)
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

"${PSQL[@]}" -c "CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;" >/dev/null
"${PSQL[@]}" -f "$BED/00_schema.sql"
fail=0
out="$("${PSQL[@]}" -f "$BED/10_before.sql" 2>&1)" || fail=1
echo "$out" | grep -E "PASSED|ERROR|FAILED|CONTEXT|WARNING|ok " || true
for m in "${MIGRATIONS[@]}"; do "${PSQL[@]}" -f "$m" 2>&1 | grep -v "does not exist, skipping" || true; done
# A second run must change nothing.
"${PSQL[@]}" -f supabase/migrations/20261104190000_users_login_attached_at.sql 2>&1 | grep -v "does not exist, skipping\|already exists, skipping" || true
for s in "$BED"/[2-9]*_*.sql; do
  out="$("${PSQL[@]}" -f "$s" 2>&1)" || fail=1
  echo "$out" | grep -E "PASSED|ERROR|FAILED|CONTEXT|WARNING|ok " || true
done
[ "$fail" = 0 ] || { echo "users_without_login bed FAILED"; exit 1; }
echo "bed ok"
