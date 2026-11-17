#!/usr/bin/env bash
# Runs supabase/tests/sub_papers against a throwaway copy of the WHOLE schema (the register of sub papers,
# punch list #350).
#
#   npm run test:pg:sub-papers
#
# The same bed as scripts/pgtest-sub-over-to-credit.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then this migration a second time, which must change nothing. The scenario,
# inside one transaction that rolls back: an estimator and an assistant in training are refused; each refusal names
# its reason and takes no number; a sheet's first paper takes the job's next number, a reprint makes nothing and a
# change is revision 2 under the same number; a deleted sheet's number and a voided paper's number are never given
# to another; a sending's record carries the sending's number and a payment from before sendings has none; a
# statement of account is always a new paper; the office reads the register, an estimator reads nothing and nobody
# types a row by hand. It raises on its first failed assertion and ends with "sub_papers PASSED". A second scenario
# (30_ack_targets.sql, punch list #371) holds what a sub answers from their page: an answer needs no paper, a payment
# is marked received once, and only the service key writes. A third (40_ack_answered.sql) holds the office marking a
# note answered: office only, once, and never by hand. PGTEST_KEEP=1
# leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that
# touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55812}"
NAME="pgtest-sub-papers"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_sub_papers.sql supabase/migrations/*_sub_paper_ack_targets.sql supabase/migrations/*_sub_paper_ack_answered.sql)"

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
# A second run must change nothing: IF NOT EXISTS tables and indexes, policies dropped and made again, two functions replaced.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/sub_papers/20_scenario.sql 2>&1 || true)"
if ! grep -q "sub_papers PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/sub_papers/30_ack_targets.sql 2>&1 || true)"
if ! grep -q "sub_paper_ack_targets PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/sub_papers/40_ack_answered.sql 2>&1 || true)"
if ! grep -q "sub_paper_ack_answered PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "sub-papers bed ok"
