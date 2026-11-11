#!/usr/bin/env bash
# Runs supabase/tests/price_sheets against a throwaway copy of the WHOLE schema (punch list #308: a supply house's
# price sheet read into the parts book; migrations *_supply_part_codes and the ones the train adds after it).
#
#   npm run test:pg:price-sheets
#
# The same bed as scripts/pgtest-bill-lines-sweep.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order, then this card's migrations a second time, which must change nothing. The probe, inside one
# transaction that rolls back: the house numbers table carries the fences; an estimator keeps a number on a part and
# reads it; one number means one thing at a house however it is dashed, and the same number is free at another house;
# a number is a part or not a part, never both; a helper reads none and writes none; a trainee writes none; a number
# goes with its part; a pasted row files a price with its source, a big move and an older paper wait, a row comes
# back, a hand edit keeps its price; a sheet is kept whole, its house settled, a pick kept, a row left out, the sheet
# removed; a kit row files with no price and keeps its number; a whole sheet comes back around a price changed by hand.
# A fixture's placement is remembered and cleared, and holds the sheet while it stands. Two copies of a part merge into
# one with everything that pointed at the copy. It raises on its first failed assertion and ends with "price_sheets PASSED". PGTEST_KEEP=1 leaves
# the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a
# migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55608}"
NAME="pgtest-price-sheets"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_supply_part_codes.sql supabase/migrations/*_price_rows.sql supabase/migrations/*_price_sheets.sql supabase/migrations/*_price_sheet_filing.sql supabase/migrations/*_price_sheet_fixtures.sql supabase/migrations/*_merge_material_parts.sql)"

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
# A second run must change nothing: the table, its policies and the function stand.
for f in $WRITES; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/price_sheets/20_scenario.sql 2>&1 || true)"
if ! grep -q "price_sheets PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "price-sheets bed ok"
