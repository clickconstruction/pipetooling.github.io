#!/usr/bin/env bash
# Runs supabase/tests/tell_the_dev against a throwaway copy of the WHOLE schema (Tell the dev, punch list #380: a
# note to the dev from any page, kept in help_feedback, and a training account allowed to send one).
#
#   npm run test:pg:tell-the-dev
#
# The same bed as scripts/pgtest-task-note-tags.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then its two migrations a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: a note needs its page or its guide; I want needs words and the
# other two starts do not; nobody writes a note as someone else; a sender reads their own notes and no other; a
# training account sends its own open note and nothing else, not through a definer function either; the owner and a
# dev read every note and answer one; and the sweep that ends every CREATE TABLE migration leaves the table's row
# guard in place. It raises on its first failed assertion and ends with "tell_the_dev PASSED". PGTEST_KEEP=1 leaves
# the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a
# migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55847}"
NAME="pgtest-tell-the-dev"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_help_feedback_page_notes.sql supabase/migrations/*_read_only_may_tell_the_dev.sql)"

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
# A second run must change nothing: each column is added only when missing, each check and policy is dropped and
# remade, the row trigger is remade and the sweep finds nothing to add.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/tell_the_dev/20_scenario.sql 2>&1 || true)"
if ! grep -q "tell_the_dev PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "tell-the-dev bed ok"
