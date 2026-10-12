#!/usr/bin/env bash
# Runs supabase/tests/messages_flows against a throwaway copy of the WHOLE schema (Messages, cut 4, the flow suite:
# the flows and their steps, the editor's history, a person's notes, skips, holds and sends, and four new facts).
#
#   npm run test:pg:messages-flows
#
# The same bed as scripts/pgtest-messages-spine.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The flows' migration is then applied a second time, which must change nothing.
# The scenario, inside one transaction that rolls back: the four flows read back step by step as SEED_FLOWS draws them;
# a second seed adds nothing and brings back no step the office removed; the CHECKs refuse an unknown fact, a loop
# that does not say when it ends and half a nudge; only the office team reads and writes; who undid a skip, let go of
# a hold or put a step back is stamped by the table; training mode and a digital twin change nothing; and the four new
# columns are there. It raises on its first failed assertion and ends with "messages_flows PASSED". PGTEST_KEEP=1
# leaves the container up. Needs docker; .github/workflows/sql-beds.yml runs it on a PR that touches a migration.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55476}"
NAME="pgtest-messages-flows"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
FLOWS="$(ls supabase/migrations/*_messages_flows.sql)"

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
# A second run must change nothing: the tables, their indexes, policies and grants, the functions and the triggers are
# there, and the seed finds nobody new.
psql_as postgres -f - < "$FLOWS" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $FLOWS"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/messages_flows/20_scenario.sql 2>&1 || true)"
if ! grep -q "messages_flows PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "messages-flows bed ok"
