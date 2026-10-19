#!/usr/bin/env bash
# Runs supabase/tests/quick_replies_shortcut against a throwaway copy of the WHOLE schema (quick replies by keyboard,
# punch list #126 C: a one-word shortcut per line).
#
#   npm run test:pg:quick-replies-shortcut
#
# The same bed as scripts/pgtest-quick-replies-phone-tech.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the shortcut migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: the office sets, repeats and clears a line's word (a leading / and
# the case forgiven), with one shortcut version each change; a word another team line holds is refused, and so is one
# of a person's own other lines, while two people's own lines and a team line may share one; a bad word, someone
# else's own line, a removed line, a primary, a training account and a direct write are refused; a removed line frees
# its word, and brought back after another line took it, it comes back without it; the unique indexes and the word's
# check hold under the functions too. It raises on its first failed assertion and ends with
# "quick_replies_shortcut PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it
# from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55513}"
NAME="pgtest-quick-replies-shortcut"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_quick_replies_shortcut.sql)"

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
# A second run must change nothing: the column and indexes are kept, the checks and functions made again the same.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/quick_replies_shortcut/20_scenario.sql 2>&1 || true)"
if ! grep -q "quick_replies_shortcut PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "quick-replies-shortcut bed ok"
