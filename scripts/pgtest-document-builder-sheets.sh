#!/usr/bin/env bash
# Runs supabase/tests/document_builder_sheets against a throwaway copy of the WHOLE schema (the Document builder's table,
# punch list #404 steps 3 to 5: document_builder_sheets, document_builder_links and document_builder_sends).
#
#   npm run test:pg:document-builder-sheets
#
# The same bed as scripts/pgtest-document-builders.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: each table carries its fences, its policies and its grants; only a builder
# that is a page with blanks takes a job's sheet; a sheet starts as a draft, goes up one revision at a time with its
# copy and its page, and only on the usual's published revision; a link is written by the service role alone, keeps
# only a hash, and one is live a sheet and a builder; a send is written by the service role, and a dev may only take
# one off a page, once; each of the other eight roles reads nothing and lands no write; a dev in training, a dev's
# twin and a dev who left are refused; and a job that goes takes its sheet, link and send with it. It raises on its
# first failed assertion and ends with "document_builder_sheets PASSED". PGTEST_KEEP=1 leaves the container up. Needs
# docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55865}"
NAME="pgtest-document-builder-sheets"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_document_builder_sheets.sql)"

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
out="$(psql_as postgres -f - < supabase/tests/document_builder_sheets/20_scenario.sql 2>&1 || true)"
if ! grep -q "document_builder_sheets PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "document-builder-sheets bed ok"
