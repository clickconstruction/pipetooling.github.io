#!/usr/bin/env bash
# Runs supabase/tests/portal_customer_page against a throwaway copy of the WHOLE schema (Messages, cut 8: the
# customer page's paper views, words and per-job switches).
#
#   npm run test:pg:portal-customer-page
#
# The same bed as scripts/pgtest-gc-customer-contacts.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). The cut 8 migration and the newest migration that seeds the
# words are then applied a second time, which must change nothing. The scenario, inside one transaction that rolls
# back: nobody signed out reads the words or the read-back; the words are seeded from the code, as many as the newest
# seed holds; the office edits a sentence, keeps its blanks and is stamped with who and when; nobody outside the office,
# in training mode or a digital twin edits one; both run once more mid-scenario (at its -- @reseed line, as a later
# push would) and follow the code only for sentences nobody edited;
# a paper view is read back per customer and paper, outside opens only, office only; a paper row names its paper and
# the usage readout still counts page loads only; the three switches start off and the office turns one on. It raises
# on its first failed assertion and ends with "portal_customer_page PASSED". PGTEST_KEEP=1 leaves the container up.
# Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55481}"
NAME="pgtest-portal-customer-page"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_portal_customer_page.sql)"
SCENARIO="supabase/tests/portal_customer_page/20_scenario.sql"
# A word change ships its own seed block in a later migration (scripts/customer-page-words-sql.ts). The newest block
# is what prod holds, and its rows are the sentence count the scenario checks.
SEED="$(grep -l '^-- customer_page_words seed: begin' supabase/migrations/*.sql | sort | tail -1)"
SEEDED="$(sed -n '/^-- customer_page_words seed: begin/,/^-- customer_page_words seed: end/p' "$SEED" | grep -c "^  ('")"
AGAIN=("$WRITES"); [ "$SEED" = "$WRITES" ] || AGAIN+=("$SEED")

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }
grep -q '^-- @reseed$' "$SCENARIO" || { echo "$SCENARIO has no -- @reseed line"; exit 2; }

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
# A second run must change nothing: the columns, the checks, the read-back, the table, its trigger, policy, grants and
# seed are there as before. The newest seed runs after the first, as on prod.
for f in "${AGAIN[@]}"; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# The scenario, with the migration and the newest seed streamed in at its -- @reseed line.
out="$({ sed -n '1,/^-- @reseed$/p' "$SCENARIO"; cat "${AGAIN[@]}"; sed -n '/^-- @reseed$/,$p' "$SCENARIO" | tail -n +2; } | psql_as postgres -v seeded="$SEEDED" -f - 2>&1 || true)"
if ! grep -q "portal_customer_page PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "portal-customer-page bed ok"
