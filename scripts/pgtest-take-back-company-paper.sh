#!/usr/bin/env bash
# Runs supabase/tests/take_back_company_paper against a throwaway copy of the WHOLE schema (punch list #403, Take back
# for a trade company's own paper).
#
#   bash scripts/pgtest-take-back-company-paper.sh
#
# The same bed as scripts/pgtest-gc-take-ask-back.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order. The function's migrations are then applied a second time, which must change
# nothing. The scenario takes papers back as the office through RLS, inside one transaction that rolls back: who may
# (a dev and the controller),
# each refusal in its words (a paper that is not a trade company's, one a job requires, one a newer copy replaced,
# one GC mode is waiting on), a signed paper and a received certificate kept, the paper gone with the company and GC
# mode's ask untouched, and the same paper taken back once the ask is kept. It raises on its first failed assertion
# and ends with "take_back_company_paper PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker;
# .github/workflows/sql-beds.yml runs it.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55934}"
NAME="pgtest-take-back-company-paper"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The function is restated by a later migration (its door, 20261124214500). The two are re-applied in order, so the
# second run ends on the live one.
WRITES="$(ls supabase/migrations/*_take_back_company_paper.sql supabase/migrations/*_take_back_dev_and_controller.sql)"

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
# A second run must change nothing: the function is replaced as it was.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/take_back_company_paper/20_scenario.sql 2>&1 || true)"
if ! grep -q "take_back_company_paper PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "take-back-company-paper bed ok"
