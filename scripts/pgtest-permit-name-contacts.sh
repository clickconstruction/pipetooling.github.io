#!/usr/bin/env bash
# Runs supabase/tests/permit_name_contacts against a throwaway copy of the WHOLE schema (v2.8296, punch list #307's
# leftovers: the phone on a permit, and the names that share a phone or a web domain with a customer; migration
# *_permit_contact_phone).
#
#   npm run test:pg:permit-name-contacts
#
# The Supabase Postgres image with every file in supabase/migrations applied in order. Then 10_before.sql writes
# Austin rows as the pull stored them before the column, and the migration runs again: its own statement fills them,
# as it filled the rows prod already held. A third run must change nothing. The probe, inside one transaction that
# rolls back: each row's phone is its contact's party's, and a number that is no phone is never kept; the two rules
# answer the lists their twins in permitLookup.ts answer; the read pairs a customer with a name by a phone on a
# permit, by a looked-up website against an email's domain, and by a phone on the contacts spine; a phone under four
# names, a lookup that found nothing and a looked-up phone said wrong tie nobody; a helper reads no pair and anon runs
# none of it. It raises on its first failed assertion and ends with "permit_name_contacts PASSED". PGTEST_KEEP=1
# leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55733}"
NAME="pgtest-permit-name-contacts"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_permit_contact_phone.sql)"

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
# The rows the pull held before the column, then the migration twice more: the first fills them, the second changes
# nothing.
psql_as postgres -f - < supabase/tests/permit_name_contacts/10_before.sql >/dev/null 2>"$ERR" || { echo "FAILED writing the rows before the column"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
for _ in 1 2; do
  psql_as postgres -f - < "$WRITES" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $WRITES"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/permit_name_contacts/20_scenario.sql 2>&1 || true)"
if ! grep -q "permit_name_contacts PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "permit-name-contacts bed ok"
