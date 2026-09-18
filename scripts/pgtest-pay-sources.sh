#!/usr/bin/env bash
# Runs supabase/tests/pay_sources against a throwaway Postgres 15 in Docker (v2.3579).
#
#   npm run test:pg:pay-sources
#
# The bed is a stand-in schema (00_schema.sql) plus the baseline's REAL payment triggers,
# extracted at run time so the check follows the baseline; then the pay_sources migration,
# then every scenario (20_scenario.sql, 30_person_admin.sql …), each raising on its first failed
# assertion and ending with a "… PASSED" notice. Needs docker and psql on PATH. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55432}"
NAME="pgtest-pay-sources"
BED="supabase/tests/pay_sources"
BASELINE="supabase/migrations/20250101000000_baseline.sql"
MIGRATIONS=(supabase/migrations/20260917200000_pay_sources.sql supabase/migrations/20260917210000_pay_sources_parts.sql supabase/migrations/20260918100000_pay_person_admin.sql supabase/migrations/20260918110000_pay_person_hours_zero.sql)
TMP="$(mktemp -d)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
command -v psql >/dev/null || { echo "psql not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

# the baseline's functions and triggers on pay_stub_payments
python3 - "$BASELINE" "$TMP/10_triggers.sql" <<'EOF'
import re, sys
src = open(sys.argv[1]).read()
blocks = re.findall(r'(CREATE OR REPLACE FUNCTION "public"\."([a-z_]+)"\(.*?\n\$\$;\n)', src, re.S)
want = [b for b, n in blocks if n in ('validate_pay_stub_payments_vs_net', 'pay_stub_payments_enforce_total_fn')]
trigs = [l for l in src.splitlines() if 'CREATE OR REPLACE TRIGGER' in l and '"public"."pay_stub_payments"' in l]
with open(sys.argv[2], 'w') as f:
    f.write('\n'.join(want) + '\n' + '\n'.join(trigs) + '\n')
print(f"triggers: {len(want)} functions, {len(trigs)} trigger(s) from the baseline")
EOF

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" postgres:15 >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
for _ in $(seq 1 60); do pg_isready -h localhost -p "$PORT" -U postgres >/dev/null 2>&1 && break; sleep 1; done
export PGPASSWORD=pg
PSQL=(psql -h localhost -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -c "CREATE ROLE authenticated; CREATE ROLE service_role;" >/dev/null
"${PSQL[@]}" -f "$BED/00_schema.sql" -f "$TMP/10_triggers.sql"
for m in "${MIGRATIONS[@]}"; do "${PSQL[@]}" -f "$m" 2>&1 | grep -v "does not exist, skipping" || true; done
for s in "$BED"/[2-9]*_*.sql; do "${PSQL[@]}" -f "$s" 2>&1 | grep -E "PASSED|ERROR|CONTEXT" || true; done
"${PSQL[@]}" -c "DO \$\$ BEGIN RAISE NOTICE 'bed ok'; END \$\$;" >/dev/null
