#!/usr/bin/env bash
# Runs supabase/tests/form_pdf_opens_outlive_paper against a throwaway copy of the WHOLE schema (punch list #403, the
# owner's fourth decision: the open log outlives its paper).
#
#   npm run test:pg:form-pdf-opens-outlive-paper
#
# The same bed as scripts/pgtest-paper-party.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the migration a second time, which must change nothing. The scenario, inside one transaction
# that rolls back: an open of a signed form keeps its paper's name and who the paper was with; deleting the paper
# leaves the line with its link emptied and its words kept; an open still needs a paper that is there; and a dev and
# the controller read the log while nobody else reads a line. It raises on its first failed assertion and ends with
# "form_pdf_opens_outlive_paper PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow
# runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55910}"
NAME="pgtest-form-pdf-opens"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_form_pdf_opens_outlive_paper.sql)"

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
# A second run must change nothing: the columns, the trigger and the key are there.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/form_pdf_opens_outlive_paper/20_scenario.sql 2>&1 || true)"
if ! grep -q "form_pdf_opens_outlive_paper PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "form-pdf-opens-outlive-paper bed ok"
