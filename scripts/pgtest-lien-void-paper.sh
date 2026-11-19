#!/usr/bin/env bash
# Runs supabase/tests/lien_void_paper against a throwaway copy of the WHOLE schema (v2.7892: voiding a filed lien
# affidavit puts its paper back).
#
#   npm run test:pg:lien-void-paper
#
# The same bed as scripts/pgtest-lien-release-sign.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then 20261119020000_lien_void_puts_paper_back.sql a second time, which must
# change nothing (the guard and the trigger's function are replaced, the trigger is dropped and made again). The
# scenario runs inside one transaction that rolls back, with the office's own writes under its own sign-in and RLS:
# a filed affidavit recorded, the paper marked sent, the filing voided. A paper the leader approved with his own
# press goes back to approved for an assistant, with his approval untouched and its tie cleared. A paper approved on
# his word keeps its note. A paper never approved goes back to the office's draft. A newer live paper on the job
# stands and the old one is set aside. A notice's filing moves nothing. A void twice moves nothing twice. By hand, a
# sent paper with a live filing still cannot be moved to approved by the office, nor can one be approved in another
# name, and the paper can be recorded as filed again. Raises on the first failed assertion; ends with
# "lien_void_paper PASSED".
#
# Docker only (GitHub's SQL beds workflow). Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55851}"
NAME="pgtest-lien-void-paper"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
MIGRATION="$(ls supabase/migrations/*_lien_void_puts_paper_back.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
. scripts/pgtest-pull.sh
pgtest_pull_supabase "$IMAGE"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"
trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1; rm -f "$ERR"' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

pgtest_migrate
# A second run of the migration must change nothing.
psql_as postgres -f - < "$MIGRATION" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $MIGRATION"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/lien_void_paper/20_scenario.sql 2>&1 || true)"
if ! grep -q "lien_void_paper PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "lien-void-paper bed ok"
