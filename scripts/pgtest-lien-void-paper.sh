#!/usr/bin/env bash
# Runs supabase/tests/lien_void_paper against a throwaway copy of the WHOLE schema (v2.7892: voiding a filed lien
# affidavit puts its paper back; v2.7911: so does voiding a § 53.056 notice's record).
#
#   npm run test:pg:lien-void-paper
#
# The same bed as scripts/pgtest-lien-release-sign.sh: the Supabase Postgres image with every file in
# supabase/migrations applied in order, then 20261119020000_lien_void_puts_paper_back.sql a second time and
# 20261119050000_lien_void_puts_notice_back.sql a second time after it, in that order: the first file's second run
# puts the affidavit-only guard and trigger back, and the later file must widen them again (the functions are
# replaced, the trigger is dropped and made again). The
# scenario runs inside one transaction that rolls back, with the office's own writes under its own sign-in and RLS:
# a filed affidavit recorded, the paper marked sent, the filing voided. A paper the leader approved with his own
# press goes back to approved for an assistant, with his approval untouched and its tie cleared. A paper approved on
# his word keeps its note. A paper never approved goes back to the office's draft. A newer live paper on the job
# stands and the old one is set aside. A void twice moves nothing twice. By hand, a
# sent paper with a live filing still cannot be moved to approved by the office, nor can one be approved in another
# name, and the paper can be recorded as filed again. A notice's record voided puts the notice back the same way,
# signed and printed as it was; a paper of another kind on the job does not set a paper aside. Raises on the first
# failed assertion; ends with
# "lien_void_paper PASSED".
#
# Punch list #443, row 2: *_lien_filing_unvoid_test.sql restates the trigger's function so that a void remembers what
# it did to a paper, so it runs a second time after the two files above, last, and the bed still ends on what prod
# runs. Its second run must leave lien_void_memory_since() at its first answer. 20_scenario.sql then proves a void
# does to a paper what it did before, and 30_unvoid.sql plays the un-void (unvoid_test_lien_filing): each paper a
# void moved comes back as it stood, and each refusal says its own sentence. Every scenario in the folder ends with
# "lien_void_paper PASSED".
#
# Docker only (GitHub's SQL beds workflow). Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55851}"
NAME="pgtest-lien-void-paper"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
MIGRATION="$(ls supabase/migrations/*_lien_void_puts_paper_back.sql)"
LATER="$(ls supabase/migrations/*_lien_void_puts_notice_back.sql)"
UNVOID="$(ls supabase/migrations/*_lien_filing_unvoid_test.sql)"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
. scripts/pgtest-pull.sh
pgtest_pull_supabase "$IMAGE"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg -p "$PORT:5432" "$IMAGE" >/dev/null
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"
trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" >/dev/null 2>&1; rm -f "$ERR"' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

pgtest_migrate
# A second run of each migration, the newest last, so the bed ends on what prod runs.
SINCE="$(psql_as postgres -At -c 'SELECT public.lien_void_memory_since()')"
for f in "$MIGRATION" "$LATER" "$UNVOID"; do
  psql_as postgres -f - < "$f" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $f"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
done
AGAIN="$(psql_as postgres -At -c 'SELECT public.lien_void_memory_since()')"
if [ -z "$SINCE" ] || [ "$SINCE" != "$AGAIN" ]; then echo "FAILED: lien_void_memory_since() moved on a second run: '$SINCE' then '$AGAIN'"; exit 1; fi
echo "ok: lien_void_memory_since() kept its first answer on a second run"
for scenario in supabase/tests/lien_void_paper/*.sql; do
  out="$(psql_as postgres -f - < "$scenario" 2>&1 || true)"
  if ! grep -q "lien_void_paper PASSED" <<<"$out"; then echo "FAILED $scenario"; echo "$out" | tail -40; exit 1; fi
  grep -o "ok: .*" <<<"$out"
done
echo "lien-void-paper bed ok"
