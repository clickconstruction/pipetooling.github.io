#!/usr/bin/env bash
# Runs supabase/tests/lien_release_sign against a throwaway copy of the WHOLE schema (the waiver signing train:
# the leader's signing code signs a Release of Lien, v2.5924; a bid's waiver, v2.5958).
#
#   npm run test:pg:lien-release-sign
#
# The same bed as scripts/pgtest-portal-opens-since.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the signing code's and the bid waiver's migrations a second time, which
# must change nothing (CHECKs, policies and the guard trigger are dropped and made again, the functions replaced).
# 20_scenario, inside one transaction that rolls back: the office signs a waiver with the leader's code on its own
# screen, a wrong code counts down and five lock it, a voided or signed waiver and a signer who is not a leader are
# refused, so are training mode and a field user, and the checker stays closed to clients. 30_bid_scoped: an estimator
# makes and reads a bid's waivers and never a job's, his waiver keeps its paper unsigned but for the leader's code,
# which signs it at his screen; a twin, a trainee and a primary are refused; the office reads and signs a bid's
# waiver; a waiver has one home; the job's feed skips a bid's waiver. Each raises on its first failed assertion and
# ends with its own "PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a ready PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55534}"
NAME="pgtest-lien-release-sign"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
CODE="$(ls supabase/migrations/*_lien_release_sign_code.sql)"
BID="$(ls supabase/migrations/*_lien_release_bid_scoped.sql)"

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

psql_as supabase_admin -f - < supabase/tests/combined_copies/00_prod_extras.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
# A second run must change nothing: the CHECKs made again, the policies, the guard, the functions, their grants. The
# bid waiver's migration restates the signing function, so it runs last again and keeps the last word.
for f in "$CODE" "$BID"; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/lien_release_sign/20_scenario.sql 2>&1 || true)"
if ! grep -q "lien_release_sign PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
out="$(psql_as postgres -f - < supabase/tests/lien_release_sign/30_bid_scoped.sql 2>&1 || true)"
if ! grep -q "lien_release_bid PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "lien-release-sign bed ok"
