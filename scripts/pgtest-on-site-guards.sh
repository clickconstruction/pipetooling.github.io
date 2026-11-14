#!/usr/bin/env bash
# Runs supabase/tests/on_site_guards against a throwaway copy of the WHOLE schema (v2.7240, punch list #344 PR 5: what
# a teammate may change on Materials on site).
#
#   npm run test:pg:on-site-guards
#
# The same bed as scripts/pgtest-on-site-move.sh: the Supabase Postgres image migrated through pgtest_migrate (every
# file in supabase/migrations in order, or in CI the leg's migrated copy), then the guards' migration a second time,
# which must change nothing. The scenario plays a helper on a job's team through RLS, inside one transaction that rolls
# back: a ledger row and a box move sent in a teammate's name and ahead of time are stamped with the caller and the
# server's time, a press that waited keeps its own time beside when it reached the office, a dev's agent label is
# kept, a box photo cannot be filed by the phone or pointed at a Drive file, another shot's place in the bucket,
# another box or another job, the phone's own changes and the sweep's still land, and a box's job cannot be changed by
# a direct update while the office's own path still can. It raises on its first failed assertion and ends with
# "on_site_guards PASSED". The move and the combine through the same tables are held by scripts/pgtest-on-site-move.sh
# and scripts/pgtest-combine-rows.sh, which run over these triggers too. PGTEST_KEEP=1 leaves the container up. Needs
# docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches
# prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55641}"
NAME="pgtest-on-site-guards"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The guards, applied a second time below.
PRESSES=(
  supabase/migrations/*_on_site_teammate_guards.sql
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
# A second run must change nothing: every function and trigger is CREATE OR REPLACE, the column ADD IF NOT EXISTS.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/on_site_guards/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "on_site_guards PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "on-site-guards bed ok"
