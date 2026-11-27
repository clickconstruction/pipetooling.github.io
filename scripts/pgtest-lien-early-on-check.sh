#!/usr/bin/env bash
# Runs supabase/tests/lien_early_on_check against a throwaway copy of the WHOLE schema (v2.8742, punch list #437 call 4:
# before a check clears, only a leader, a controller or a dev may let a lien's release go).
#
#   npm run test:pg:lien-early-on-check
#
# The same bed as scripts/pgtest-lien-release-sign.sh: the Supabase Postgres image migrated through pgtest_migrate
# (every file in supabase/migrations in order, or in CI the leg's migrated copy), then the guard's migration a second
# time, which must change nothing. The scenario plays each of the nine roles through RLS, inside one transaction that
# rolls back: an early release (a release_of_record row that carries releasedBeforeClearedReason) and The bank
# confirmed the funds (fields.fundsConfirmed set, changed and taken off) land for a dev, a leader and a controller and
# are refused in the guard's words for everyone else; every other insert and update the office makes still passes,
# for an assistant too, on a lien that carries a confirmation as well; a field role is refused its plain insert by the
# row policy as before; and a write with no sign-in behind it passes the guard. It raises on its first failed
# assertion and ends with "lien_early_on_check PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL
# beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55948}"
NAME="pgtest-lien-early-on-check"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The guard's migration, applied a second time below.
PRESSES=(
  supabase/migrations/*_lien_early_on_check_three_roles.sql
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
# A second run must change nothing: the function is replaced and the trigger dropped and made again.
for press in "${PRESSES[@]}"; do
  psql_as postgres -f - < "$press" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $press"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
for scenario in supabase/tests/lien_early_on_check/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "lien_early_on_check PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "lien-early-on-check bed ok"
