#!/usr/bin/env bash
# Runs supabase/tests/supply_house_payments against a throwaway Postgres 15 in Docker.
#
#   npm run test:pg:supply-house-payments
#
# The bed is a stand-in schema (00_schema.sql), the baseline's REAL triggers on supply_house_invoices
# (the paid_at stamp and updated_at, extracted at run time so the check follows the baseline), bills as
# prod holds them before payments were rows (10_seed_before.sql), then migration 20261116230000 TWICE
# (it must apply twice and the backfill must do nothing the second time), then every scenario, each
# raising on its first failed check and ending with a "… PASSED" notice. One psql session, so the
# scenario can read the snapshot the seed took. Needs docker and psql on PATH. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55433}"
NAME="pgtest-supply-house-payments"
BED="supabase/tests/supply_house_payments"
BASELINE="supabase/migrations/20250101000000_baseline.sql"
MIGRATIONS=(supabase/migrations/20261116230000_supply_house_payments.sql supabase/migrations/20261117010000_supply_house_payment_moves.sql)
TMP="$(mktemp -d)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
command -v psql >/dev/null || { echo "psql not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

python3 - "$BASELINE" "$TMP/05_triggers.sql" <<'PY'
import re, sys
src = open(sys.argv[1]).read()
blocks = re.findall(r'(CREATE OR REPLACE FUNCTION "public"\."([a-z_]+)"\(.*?\n\$\$;\n)', src, re.S)
want = [b for b, n in blocks if n in ('sync_supply_house_invoice_paid_at', 'update_updated_at_column')]
trigs = [l for l in src.splitlines() if 'CREATE OR REPLACE TRIGGER' in l and '"public"."supply_house_invoices"' in l]
with open(sys.argv[2], 'w') as f:
    f.write('\n'.join(want) + '\n' + ';\n'.join(t.rstrip(';') for t in trigs) + ';\n')
print(f"triggers: {len(want)} functions, {len(trigs)} trigger(s) from the baseline")
PY

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" postgres:15 >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
for _ in $(seq 1 60); do pg_isready -h localhost -p "$PORT" -U postgres >/dev/null 2>&1 && break; sleep 1; done
export PGPASSWORD=pg
PSQL=(psql -h localhost -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE anon;" >/dev/null
ARGS=(-f "$BED/00_schema.sql" -f "$TMP/05_triggers.sql" -f "$BED/10_seed_before.sql")
for m in "${MIGRATIONS[@]}"; do ARGS+=(-f "$m" -f "$m"); done
for s in "$BED"/[2-9]*_*.sql; do ARGS+=(-f "$s"); done
# The bed passes only when psql ran every file to the end and the closing notice was raised.
rc=0
OUT="$("${PSQL[@]}" "${ARGS[@]}" 2>&1)" || rc=$?
printf '%s\n' "$OUT" | grep -E "PASSED|ERROR|FAILED|CONTEXT" || true
if [ "$rc" -ne 0 ] || ! printf '%s\n' "$OUT" | grep -q "supply house payments: ALL PASSED"; then
  echo "supply house payments: the bed FAILED (psql exit $rc)"
  exit 1
fi
