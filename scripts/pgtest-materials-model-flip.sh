#!/usr/bin/env bash
# Runs supabase/tests/materials_model_flip against a throwaway copy of the WHOLE schema (v2.4405).
#
#   npm run test:pg:materials-model-flip
#
# The same bed as scripts/pgtest-combined-copies.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order (about a minute). Then: seed three old bids, two flagged
# By Stage with a March updated_at; run the flip migration again, twice; check every bid is
# Combined, the dates did not move, and the updated_at trigger is back on. Ends with
# "materials_model_flip PASSED". Needs docker. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55436}"
NAME="pgtest-materials-model-flip"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
BED="supabase/tests/materials_model_flip"
MIGRATION="supabase/migrations/20261002120000_bids_materials_model_all_combined.sql"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
# psql's errors go to this run's own file: a fixed /tmp name may belong to another user on a shared Mac.
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"
trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1; rm -f "$ERR"' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
psql_as postgres -v part=seed -f - < "$BED/20_scenario.sql" 2>&1 | grep -E "SEEDED|ERROR" || { echo "seed failed"; exit 1; }
psql_as postgres -f - < "$MIGRATION" 2>&1 | grep -E "NOTICE|ERROR" || true
# A second run must change nothing.
psql_as postgres -f - < "$MIGRATION" 2>&1 | grep -E "NOTICE|ERROR" || true
out="$(psql_as postgres -v part=check -f - < "$BED/20_scenario.sql" 2>&1 || true)"
if ! grep -q "materials_model_flip PASSED" <<<"$out"; then echo "$out" | tail -30; exit 1; fi
echo "materials-model-flip bed ok"
