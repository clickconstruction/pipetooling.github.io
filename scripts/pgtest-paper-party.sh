#!/usr/bin/env bash
# Runs supabase/tests/paper_party against a throwaway copy of the WHOLE schema (where an outside signer lives, the
# ground, punch list #403: a paper names the contact of the party it is with and keeps who signs).
#
#   npm run test:pg:paper-party
#
# The same bed as scripts/pgtest-agreements-on-file.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the ground's migration a second time and the migration that widens the
# estimator's read after it (*_estimator_reads_outside_papers, which restates the ground's policy), which must change
# nothing. The scenario, inside one transaction that rolls back: the door finds or makes the contact of each kind of
# record a paper can be with, for the four roles that send a paper; a party's paper is filed under a name no person can
# have and keeps no roster person; Documents → Agreements lists it under one of four new kinds; each role reads what it
# read before, but the estimator, who reads every kind of an outside company's paper and no person's paper and nobody
# on no list; the signed form's gate is told yes for exactly those papers; the paper follows its contact through Who
# is this?, a fold and a deleted record; the fold's
# helper moves nothing for a twin, a training account, an archived account or a primary; since *_estimator_reach a
# contact that holds a paper is named by the four roles alone, while an estimator reads the layout and the signature
# image of an outside company's paper and a training estimator reads neither; and a party's paper finds its customer,
# supply house or trade company by the record's key, with every reader's lines the same as the view's before (punch
# list #430). It raises on its first failed
# assertion and ends with "paper_party PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds
# workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55903}"
NAME="pgtest-paper-party"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# In order: the ground puts its own policy back, then the widening restates it, as on prod.
# Last, the view's newest definition (punch list #403, the owner's first decision): the ground restates the view as
# it stood, so the migration that widens it to every paper of an outside party runs after it, as on prod.
# And the estimator's reach (punch list #403, the owner's second decision): the ground also puts the fold's helper
# back as it stood, so the migration that adds its refusal runs after it, as on prod. Then the one that finds a party's
# record by its key (punch list #430), which restates the view again with three joins as a CASE.
WRITES="$(ls supabase/migrations/*_paper_party.sql) $(ls supabase/migrations/*_estimator_reads_outside_papers.sql) $(ls supabase/migrations/*_agreements_every_party_paper.sql) $(ls supabase/migrations/*_estimator_reach.sql) $(ls supabase/migrations/*_agreements_party_join_by_key.sql)"

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
# A second run must change nothing: the columns, the index, the checks, the trigger, the helper, the door, the policy
# and the view are there, and the audience check is put back as it stood. Then the widening, a second time.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/paper_party/20_scenario.sql 2>&1 || true)"
if ! grep -q "paper_party PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "paper-party bed ok"
