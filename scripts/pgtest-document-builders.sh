#!/usr/bin/env bash
# Runs supabase/tests/document_builders against a throwaway copy of the WHOLE schema (the Document builder's table,
# punch list #404 step 2: document_builders).
#
#   npm run test:pg:document-builders
#
# The same bed as scripts/pgtest-job-finish-calls.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the table's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: the table carries its fences and its four policies, a dev loads a
# first draft that starts as a draft whatever was sent, a revision goes up one at a time and only with its published
# copy, a published copy changes only with its revision, only the published revision can be marked as read, who made,
# published and marked it is the caller, each of the other eight roles reads nothing and lands no write, and a dev in
# training, a dev's twin and a dev who left are refused. It raises on its first failed assertion and ends with
# "document_builders PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55864}"
NAME="pgtest-document-builders"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_document_builders.sql)"

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
# A second run must change nothing: IF NOT EXISTS, CREATE OR REPLACE, and the policies dropped and made again.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/document_builders/20_scenario.sql 2>&1 || true)"
if ! grep -q "document_builders PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "document-builders bed ok"
