#!/usr/bin/env bash
# Runs supabase/tests/site_secrecy_mend against a throwaway copy of the WHOLE schema: the proof that the mend for the
# site secrecy ground (punch list #439, piece 4a) applies after it and puts the gate back as prod ran it before.
#
#   npm run test:pg:site-secrecy-mend
#
# The bed lives only on the branch that holds the mend, claude/439-site-secrecy-mend, which is never merged as it is.
# There pgtest_migrate applies every migration in order, so the ground and then the mend: that the copy is made at all
# is the first proof. Then, in three steps:
#   10  on that copy, the nine functions of the gate have the md5 prod ran on 2026-11-27 before the ground, the lock's
#       own question is untouched, and the two trigger functions do nothing.
#   20  the ground is applied again, as prod will hold it, and a site is turned on: the office presses, the site's
#       paper lands on its two jobs, and a helper who has not signed is shut out of both. This step is kept.
#   30  the mend is applied again, now over a site that is on, as it would be used: the site is off and its rows are
#       off their jobs, the helper is told of each job what he was told before the site went on and reads the rows he
#       read then, the nine md5s are prod's again, turn-on refuses with its reason, and a job still saves.
# It raises on its first failed assertion and ends with "site_secrecy_mend PASSED". PGTEST_KEEP=1 leaves the container
# up. Needs docker. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55441}"
NAME="pgtest-site-secrecy-mend"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
GROUND="$(ls supabase/migrations/*_site_secrecy.sql)"
MEND="$(ls supabase/migrations/*_site_secrecy_mend.sql)"

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

apply() { psql_as postgres -f - < "$1" >/dev/null 2>"$ERR" || { echo "FAILED applying $1"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }; }
step() {
  local out
  out="$(psql_as postgres -f - < "$1" 2>&1 || true)"
  if ! grep -q "$2" <<<"$out"; then echo "FAILED $1"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out" || true
}

pgtest_migrate
step supabase/tests/site_secrecy_mend/10_after_the_mend.sql "step 10 PASSED"
apply "$GROUND"
step supabase/tests/site_secrecy_mend/20_a_site_on.sql "step 20 PASSED"
apply "$MEND"
step supabase/tests/site_secrecy_mend/30_the_mend_over_a_site.sql "site_secrecy_mend PASSED"
echo "site-secrecy-mend bed ok"
