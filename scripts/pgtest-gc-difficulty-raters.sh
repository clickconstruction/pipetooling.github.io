#!/usr/bin/env bash
# Runs supabase/tests/gc_difficulty_raters against a throwaway copy of the WHOLE schema (punch list #357, v2.7468: the
# GC difficulty rating's insert rule asks the Bid Board's published price list who may rate, and the list names the
# estimators).
#
#   npm run test:pg:gc-difficulty-raters
#
# The same bed as scripts/pgtest-quick-replies.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The migration is then applied a second time, which must change nothing: no third
# price list version, the function replaced as it was, one insert rule. The scenario, inside one transaction that rolls
# back: version 2 is version 1's numbers with the estimators named; under it a dev, the owner, an assistant, a
# controller and an estimator save a rating and a primary, a superintendent, a sub, a helper and someone signed out
# are refused, with gc_difficulty_can_rate() answering the same; the list obeyed both ways (only the estimators, the
# office and the masters, nobody, no list); a draft deciding nothing; an estimator in training, a digital twin and an
# archived estimator refused by their fences; a rating written once and deleted by a dev alone. It raises on its first
# failed assertion and ends with "gc_difficulty_raters PASSED".
# PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a PR
# that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55801}"
NAME="pgtest-gc-difficulty-raters"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_gc_difficulty_raters_from_price_list.sql)"

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
# A second run must change nothing: the estimators are already named, so no version is added; the function and the
# insert rule are made again as they were.
psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
out="$(psql_as postgres -f - < supabase/tests/gc_difficulty_raters/20_scenario.sql 2>&1 || true)"
if ! grep -q "gc_difficulty_raters PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "gc-difficulty-raters bed ok"
