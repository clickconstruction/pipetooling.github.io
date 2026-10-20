#!/usr/bin/env bash
# Runs supabase/tests/quick_replies against a throwaway copy of the WHOLE schema (Messages, cut 3: quick replies, the
# lines the office types every day, with every change a version and every press counted).
#
#   npm run test:pg:quick-replies
#
# The same bed as scripts/pgtest-messages-spine.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The migration is then applied a second time, which must change nothing, its seed
# included. The scenario, inside one transaction that rolls back: the seed's thirteen team lines, once, and none of the
# three that name a demo job; Rosa adds a line and changes its words, Maria its tags, two versions with who; presses counted
# and read by the team; a removed line comes back with its history; each refusal in words, and a superintendent, a
# training account, a digital twin and someone signed out refused; nobody writes the tables by hand; Rosa's title; a
# fold moves the presses; then R3's Spanish and the phone's place, each with its version, and a sent text's line. It raises
# on its first failed assertion and ends with "quick_replies PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR
# that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55481}"
NAME="pgtest-quick-replies"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_quick_replies.sql)"

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

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# A second run must change nothing: the column, the tables, their policies and grants are there, every function is
# replaced as it was, and the seed adds no line.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
# R3 drops edit_quick_reply's four-argument signature for one with three more. The second run above made the old one
# again beside it, so R3's migration runs again last, which drops it and leaves the new one alone.
LATER="$(ls supabase/migrations/*_quick_replies_phone_es.sql)"
psql_as postgres -f - < "$LATER" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $LATER"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/quick_replies/20_scenario.sql 2>&1 || true)"
if ! grep -q "quick_replies PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "quick-replies bed ok"
