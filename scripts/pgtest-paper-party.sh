#!/usr/bin/env bash
# Runs supabase/tests/paper_party against a throwaway copy of the WHOLE schema (where an outside signer lives, the
# ground, punch list #403: a paper names the contact of the party it is with and keeps who signs).
#
#   npm run test:pg:paper-party
#
# The same bed as scripts/pgtest-agreements-on-file.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the ground's migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: the door finds or makes the contact of each kind of record a paper
# can be with, for the four roles that send a paper; a party's paper is filed under a name no person can have and
# keeps no roster person; Documents → Agreements lists it under one of four new kinds; each role reads what it read
# before, but the estimator, who now reads an outside company's agreement and no person's paper, no tax form and
# nobody on no list; the paper follows its contact through Who is this?, a fold and a deleted record; and the fold's
# helper moves nothing for a twin, a training account, an archived account or a primary. It raises on its first failed
# assertion and ends with "paper_party PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds
# workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55903}"
NAME="pgtest-paper-party"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_paper_party.sql)"

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
# and the view are there, and the audience check is put back as it stood.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/paper_party/20_scenario.sql 2>&1 || true)"
if ! grep -q "paper_party PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "paper-party bed ok"
