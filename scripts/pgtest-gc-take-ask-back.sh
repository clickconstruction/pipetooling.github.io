#!/usr/bin/env bash
# Runs supabase/tests/gc_take_ask_back against a throwaway copy of the WHOLE schema (v2.8440, the Board's take-back
# of an ask).
#
#   bash scripts/pgtest-gc-take-ask-back.sh
#
# The same bed as scripts/pgtest-gc-award.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order. The take-back's migration is then applied a second time, which must change nothing. The scenario
# takes asks back as the office through RLS, inside one transaction that rolls back: who may, each refusal in its
# words (an award, a statement of work, a quote, the company's own pass), every way the company can have heard of the
# ask closing it as ours instead (v2.8490), the ask and its notes gone, the row the undo leaves in gc_asks_taken_back and who reads it, the bench's
# Remove letting the company go afterwards by its own rule, and the award guard still refusing a plain write. It
# raises on its first failed assertion and ends with "gc_take_ask_back PASSED". PGTEST_KEEP=1 leaves the container
# up. Needs docker; .github/workflows/sql-beds.yml runs it.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55932}"
NAME="pgtest-gc-take-ask-back"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
# The first take-back, then the answer that restates its function (v2.8490): in that order, so the newer one stands.
WRITES="$(ls supabase/migrations/*_gc_take_ask_back.sql) $(ls supabase/migrations/*_gc_ask_taken_back_answer.sql)"

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
# A second run must change nothing: every function is replaced as it was, and each DO block adds no
# second constraint.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/gc_take_ask_back/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_take_ask_back PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-take-ask-back bed ok"
