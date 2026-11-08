#!/usr/bin/env bash
# Runs supabase/tests/estimate_share_links against a throwaway copy of the WHOLE schema (bills and estimates in a
# message, punch list #127 PR 3: a second link to an estimate per share, the owner's pick B).
#
#   npm run test:pg:estimate-share-links
#
# The same bed as scripts/pgtest-quick-replies-phone-tech.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then the share links migration and the short codes migration (#281 PR 2,
# v2.6677) a second time each, which must change nothing. The scenario, inside one transaction that rolls back: the
# office makes a link to a sent and to an approved estimate, each its own ten-letter code from the alphabet with no
# look-alikes, kept only as its SHA-256 (the hash the edge functions compute), fourteen days long, with who made it;
# the emailed link's hash is untouched; a draft, a missing estimate, a primary, a training account, a twin and anon are
# refused; whoever reads the estimate reads its links and nobody signed in writes them; the read-only fences are on;
# the guard on guessing counts misses by source and hour for the service role alone and nobody signed in reads it. It
# raises on its first failed assertion and ends with "estimate_share_links PASSED". PGTEST_KEEP=1 leaves the container
# up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt on a ready PR that touches a migration.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55514}"
NAME="pgtest-estimate-share-links"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
WRITES="$(ls supabase/migrations/*_estimate_share_links.sql supabase/migrations/*_estimate_short_codes.sql)"

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
# A second run of each must change nothing: the tables are kept, the policies and the functions made again the same.
for w in $WRITES; do
  psql_as postgres -f - < "$w" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $w"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
out="$(psql_as postgres -f - < supabase/tests/estimate_share_links/20_scenario.sql 2>&1 || true)"
if ! grep -q "estimate_share_links PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "estimate-share-links bed ok"
