#!/usr/bin/env bash
# Runs supabase/tests/archived_seal against a throwaway copy of the WHOLE schema (v2.6572, punch list #256 PR 7: the seal
# behind the Away note; migration *_archived_seal).
#
#   npm run test:pg:archived-seal
#
# The same bed as scripts/pgtest-stage-check-self-close.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then this migration a second time, which must change nothing. The probe, inside
# one transaction that rolls back: every RLS table and storage.objects carry archived_fence; an active dev reads the
# accounts and the job and updates his own row where the archived one reads no row of any table and updates nothing;
# the pre-request gate refuses the archived caller on a table, a view, GraphQL and every RPC authenticated may call,
# passes it to /rpc/my_away_note alone, and passes everyone else; the gate is set on authenticator; the predicate's
# cost is printed. It raises on its first failed assertion and ends with "archived_seal PASSED". PGTEST_KEEP=1 leaves
# the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a
# migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55560}"
NAME="pgtest-archived-seal"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_archived_seal.sql)"

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
# A second run must change nothing: the three functions as restated, the fences already there, the setting the same.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/archived_seal/20_scenario.sql 2>&1 || true)"
if ! grep -q "archived_seal PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "archived-seal bed ok"
