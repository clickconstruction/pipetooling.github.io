#!/usr/bin/env bash
# Runs supabase/tests/paper_settings against a throwaway copy of the WHOLE schema (punch list #389 step 1: the
# Contract Book takes settings).
#
#   npm run test:pg:paper-settings
#
# The same bed as scripts/pgtest-contract-clauses.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the settings migration a second time, which must change nothing. The
# scenario, inside one transaction that rolls back: a set of cases runs through the database's assembly (the same
# cases run through the kernel in src/lib/contracts/paperSettings.cases.test.ts, which reads them out of the scenario
# file), an ordinary paper reads as before, nobody signed in writes the list, the read mark or the revision by hand,
# only a controller or a dev sets a list or marks a read and never a twin, training or someone who left, a clause is
# tied only to what the list has, a read belongs to a revision, and a copy of a paper built from settings is never
# made bare. It raises on its first failed assertion and ends with "paper_settings PASSED". PGTEST_KEEP=1 leaves the
# container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR that touches a
# migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55866}"
NAME="pgtest-paper-settings"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_paper_settings.sql)"

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
# A second run must change nothing: the tables, their indexes, policies and triggers are there, with the same grants.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/paper_settings/20_scenario.sql 2>&1 || true)"
if ! grep -q "paper_settings PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "paper-settings bed ok"
