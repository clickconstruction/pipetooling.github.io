#!/usr/bin/env bash
# Runs supabase/tests/agreements_on_file against a throwaway copy of the WHOLE schema (Documents → Agreements' one list,
# punch list #376: the agreements_on_file view over job_contracts, person_contract_documents, step_commitments,
# gc_owner_contract_sends and gc_sows).
#
#   npm run test:pg:agreements-on-file
#
# The same bed as scripts/pgtest-helper-on-job.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then the view's newest migration a second time, which must change nothing. The scenario, inside one transaction
# that rolls back: the office reads every agreement in the order the page draws them, with its state, name, party, job
# and day; one paper filed over three jobs is one line; drafts, unsent papers and papers that are not agreements are
# absent; the facts carry each kind's own columns and no amount; and each role reads only what its tables allow (an
# estimator work orders and a trade company's agreement, with the company's W-9 a row they read and no line, a primary
# and a superintendent nothing, a sub their own work order, nobody signed out).
# It raises on its first failed assertion and ends with "agreements_on_file PASSED". PGTEST_KEEP=1 leaves the container
# up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never
# touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55814}"
NAME="pgtest-agreements-on-file"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The newest definition of the view: re-applying an older one would put the older view back. Since punch list #403 that
# is the ground of where an outside signer lives, which restates the view with a party's paper.
# That migration also puts the estimator's first read policy back, so the one that widens it runs after it, as on prod.
# Last, the view's newest definition (punch list #403, the owner's first decision): the ground restates the view as
# it stood, so the migration that widens it to every paper of an outside party runs after it, as on prod.
# And the estimator's reach (punch list #403, the owner's second decision): the ground also puts the fold's helper
# back as it stood, so the migration that adds its refusal runs after it, as on prod.
# Last of all, the site a paper names (punch list #439): the view restated once more with three columns at its end. A
# view never loses a column, so an older definition cannot replace the wider view: the view is dropped before the
# files below are applied again, and the newest definition, applied last, makes it as prod has it.
WRITES="$(ls supabase/migrations/*_paper_party.sql) $(ls supabase/migrations/*_estimator_reads_outside_papers.sql) $(ls supabase/migrations/*_agreements_every_party_paper.sql) $(ls supabase/migrations/*_estimator_reach.sql) $(ls supabase/migrations/*_agreements_on_file_site.sql) $(ls supabase/migrations/*_agreements_on_file_site_print.sql)"

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
# A second run must change nothing: the view made again as it stood, the same grant. Nothing may depend on the view,
# so the drop is a plain one and fails aloud if something does.
psql_as postgres -c "DROP VIEW public.agreements_on_file" >/dev/null 2>"$ERR" || { echo "FAILED dropping the view before its files are applied again"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/agreements_on_file/20_scenario.sql 2>&1 || true)"
if ! grep -q "agreements_on_file PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "agreements-on-file bed ok"
