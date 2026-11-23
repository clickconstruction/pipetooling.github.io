#!/usr/bin/env bash
# Runs supabase/tests/imitated_session against a throwaway copy of the WHOLE schema (v2.8251: View as and Imitate, the
# heartbeat's refusal of a session someone else opened; migration *_imitated_session_holds_app_activity).
#
#   npm run test:pg:imitated-session
#
# The same bed as scripts/pgtest-away-notes.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this migration a second time, which must change nothing. The probe, inside one transaction that
# rolls back: session_opened_by_imitation() is open to a signed-in caller alone; a password session is never an
# imitation; a magic-link sign-in (amr otp or magiclink) from a minute before a user_imitations row of the same person
# to two minutes after it is one, and bump_user_app_activity() then writes nothing; a person's own emailed link ten
# minutes later is not, and is counted; an imitation of someone else says nothing; a claim that cannot be read answers
# false and never raises. It raises on its first failed assertion and ends with "imitated_session PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a
# ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55909}"
NAME="pgtest-imitated-session"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_imitated_session_holds_app_activity.sql)"

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
# A second run must change nothing: both functions are restated the same.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/imitated_session/20_scenario.sql 2>&1 || true)"
if ! grep -q "imitated_session PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "imitated-session bed ok"
