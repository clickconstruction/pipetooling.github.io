#!/usr/bin/env bash
# Runs supabase/tests/messages_follow_up against a throwaway copy of the WHOLE schema (Messages, cut 2, Follow up: the
# conversation's state and who has it, what we owe, what a line was read as, highlights, the badge).
#
#   npm run test:pg:messages-follow-up
#
# The same bed as scripts/pgtest-messages-spine.sh: the Supabase Postgres image with every file in supabase/migrations
# applied in order (about a minute). The Follow up migration is then applied a second time, which must change nothing.
# The scenario, inside one transaction that rolls back: every press refuses no sign-in, a training account, a digital
# twin and anyone off the office team, in words; a message moves the state as it lands, and an older line moves
# nothing; who has it writes a gray line; Remind me Monday runs to the coming Monday and wakes on its day or on their
# message; what we owe is one open row a person, every change a gray line, and a team note marks it done; the badge
# counts each person once, and a newer note's day replaces an older one; a heard day is written as a kind by who they
# are; a plans question goes to the architect; highlights; Who is this? folds what we owe and the state; who reads
# what; and the seats are the owner's to set. It raises on its first failed assertion and ends with
# "messages_follow_up PASSED". PGTEST_KEEP=1 leaves the container up. Needs docker; the SQL beds workflow runs it from
# scripts/sql-beds.txt on a PR that touches a migration. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PGTEST_PORT:-55476}"
NAME="pgtest-messages-follow-up"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
FOLLOW_UP="$(ls supabase/migrations/*_messages_follow_up.sql)"

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
  # A second run must change nothing, so the Follow up migration is applied again right here, in its own place: a later
  # migration that redefines one of its functions keeps the newer body (2026-10-17: re-applying it after every other
  # file silently put the old follow_up_count back, and the bed tested a function prod does not run).
  if [ "$f" = "$FOLLOW_UP" ]; then
    psql_as postgres -f - < "$FOLLOW_UP" >/dev/null 2>"$ERR" || { echo "FAILED re-applying $FOLLOW_UP"; grep -E -A6 "ERROR|FATAL" "$ERR" | head -20; exit 1; }
  fi
done
out="$(psql_as postgres -f - < supabase/tests/messages_follow_up/20_scenario.sql 2>&1 || true)"
if ! grep -q "messages_follow_up PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
# Punch list #140 PR 7 (*_log_call): the reply box's Call kind writes our call line through log_call, the day they gave
# as a written promise, and closes their calls to make; who may, in words.
out="$(psql_as postgres -f - < supabase/tests/messages_follow_up/30_log_call.sql 2>&1 || true)"
if ! grep -q "messages_log_call PASSED" <<<"$out"; then echo "$out" | tail -40; exit 1; fi
grep -o "ok: .*" <<<"$out"
echo "messages-follow-up bed ok"
