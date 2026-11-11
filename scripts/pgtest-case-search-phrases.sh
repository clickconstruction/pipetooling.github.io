#!/usr/bin/env bash
# Runs supabase/tests/case_search_phrases against a throwaway copy of the WHOLE schema (v2.6938: the case search finds
# a quoted phrase wherever it sits in a long text; migration *_case_search_phrases).
#
#   npm run test:pg:case-search-phrases
#
# The same bed as scripts/pgtest-theme-review.sh: the Supabase Postgres image migrated through pgtest_migrate (every
# file in supabase/migrations in order, or in CI the leg's migrated copy), then this migration a second time, which
# must change nothing. The scenario, inside one transaction that rolls back: what fts_prefilter asks an index for a
# phrase, a word left out, a phrase left out and an or; fts_hit on a text alone, with a phrase past the 16,383rd word
# and one after a word's 255th use, each missed by the plain test and found here; then dev_case_search as a dev
# through RLS over a made-up shop log of twelve sections and 24,000 words — the phrase found quoted and unquoted in its
# late sections, a phrase whose words never sit together and one whose words sit in two sections found nowhere, a word
# left out dropping its section and not the document — and over a document with no headings, the summary, a file's
# text and a matter's text document; a late hit's snippet and rank; who may call; and the plan of each index test,
# which must read its GIN index. It raises on its first failed assertion and ends with "case_search_phrases PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a
# ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55612}"
NAME="pgtest-case-search-phrases"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The search's migration, applied a second time below.
WRITES=(
  supabase/migrations/*_case_search_phrases.sql
)

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
# A second run must change nothing: the functions are CREATE OR REPLACE and their grants are restated.
for write in "${WRITES[@]}"; do
  psql_as postgres -f - < "$write" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $write"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/case_search_phrases/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "case_search_phrases PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "case-search-phrases bed ok"
