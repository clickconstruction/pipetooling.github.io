#!/usr/bin/env bash
# Runs supabase/tests/gc_bench_hold against a throwaway copy of the WHOLE schema (v2.8747, punch list #443's finding
# 338: one hold, read by the Remove press's function and by the Trade partners list).
#
#   npm run test:pg:gc-bench-hold
#
# The same bed as scripts/pgtest-gc-take-ask-back.sh: the Supabase Postgres image migrated through pgtest_migrate
# (every file in supabase/migrations in order, or in CI the leg's migrated copy), then the hold's migration a second
# time, which must change nothing. The scenario, inside one transaction that rolls back: one made-up company for each
# kind of history and two with none. The list's read (gc_bench_holds) answers each company's reason and NULL for the
# two; the remove (gc_remove_bench_company) refuses each held company in the same words and takes a clean one off;
# the hold itself is nobody's to call; the office reads the list, a training account too, and a field role, a digital
# twin, an archived caller and a caller with no sign-in read no row. It raises on its first failed assertion and ends
# with "gc_bench_hold PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55949}"
NAME="pgtest-gc-bench-hold"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The hold's migration, applied a second time below.
PRESSES=(
  supabase/migrations/*_gc_bench_one_hold.sql
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
# A second run must change nothing: three functions replaced, their comments and grants said again.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/gc_bench_hold/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "gc_bench_hold PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "gc-bench-hold bed ok"
