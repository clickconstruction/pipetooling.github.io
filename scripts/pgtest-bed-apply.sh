#!/usr/bin/env bash
# Runs pgtest_apply (scripts/pgtest-pull.sh), the one psql every bed applies its migrations through, against a bare
# Supabase Postgres with no migrations (v2.6404).
#
#   npm run test:pg:bed-apply
#
# The other beds only ever see it pass, so this is where its promises are held. A run gives each file a session of its
# own, and a file with no final semicolon or newline ends with the file. A file given twice in a row runs twice, in its
# place. A failure stops the run, says "FAILED applying <file>" with the error and the file's own line, and never runs
# the next file. A second run that fails says "re-applying". A file that ends inside a string fails as itself. A run cut
# short, which exits 0, still fails. A \q ends only its own file, as each file's own psql did. pgtest_migrate, in a
# container whose label says it was made from the leg's migrated copy of these files, applies nothing, and it refuses a
# copy of other files (v2.6415). It stops on its first failed check and ends with "bed-apply bed ok". PGTEST_KEEP=1
# leaves the container up. Needs docker; the SQL beds workflow runs it from scripts/sql-beds.txt.
# Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="pgtest-bed-apply"
IMAGE="${PGTEST_SUPABASE_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.071}"
BED="supabase/tests/bed_apply"

command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker is not running"; exit 2; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
. scripts/pgtest-pull.sh
pgtest_pull_supabase "$IMAGE"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg "$IMAGE" >/dev/null
# psql's errors go to this run's own file: a fixed /tmp name may belong to another user on a shared Mac.
ERR="$(mktemp "${TMPDIR:-/tmp}/$NAME.XXXXXX")"
trap '[ -n "${PGTEST_KEEP:-}" ] || docker rm -f "$NAME" "$NAME-copy" >/dev/null 2>&1; rm -f "$ERR"' EXIT
for _ in $(seq 1 90); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 5
psql_as() { local user="$1"; shift; docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

same() { # what it is, the answer, the answer it should be
  [ "$2" = "$3" ] || { echo "FAILED $1: got [$2], expected [$3]"; exit 1; }
  echo "ok: $1"
}
says() { # what it is, the words the output must hold, the output
  grep -Fq -- "$2" <<<"$3" || { echo "FAILED $1: no [$2] in:"; echo "$3"; exit 1; }
  echo "ok: $1"
}
ran() { psql_as postgres -At -c "SELECT string_agg(file, ' ' ORDER BY n) FROM public.bed_apply_ran"; }
# A failing run in a shell of its own, since pgtest_apply's failure stops its shell. It must fail.
fails() {
  local out
  if out="$( (pgtest_apply "$@") 2>&1 )"; then echo "FAILED a run that should have failed passed: $*" >&2; exit 1; fi
  echo "$out"
}

# A fixture an editor "fixed" would pass here for the wrong reason.
for f in 10_leaves_a_session 15_no_semicolon_no_newline 16_comment_last; do
  [ -n "$(tail -c 1 "$BED/$f.sql")" ] || { echo "FAILED $BED/$f.sql has gained a final newline"; exit 1; }
done

pgtest_apply "$BED/10_leaves_a_session.sql" "$BED/15_no_semicolon_no_newline.sql" "$BED/15_no_semicolon_no_newline.sql" "$BED/16_comment_last.sql" "$BED/20_clean_session.sql"
same "every file ran in the order given, and the file given twice ran twice in its place" "$(ran)" "10 15 15 16 20"
same "each file had a session of its own" "$(psql_as postgres -At -c "SELECT count(DISTINCT pid) FROM public.bed_apply_ran")" "5"
same "no file's lock outlived its session" "$(psql_as postgres -At -c "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'")" "0"

out="$(fails "$BED/30_runs_before_the_failure.sql" "$BED/31_fails_on_line_3.sql" "$BED/32_never_runs.sql")"
says "a failure names its file" "FAILED applying $BED/31_fails_on_line_3.sql" "$out"
says "a failure gives the error with the file and its own line" "psql:$BED/31_fails_on_line_3.sql:3: ERROR:  relation \"public.bed_apply_no_such_table\" does not exist" "$out"
same "the files before the failure ran, and nothing after it" "$(ran)" "10 15 15 16 20 30 31"

out="$(fails "$BED/33_fails_on_a_second_run.sql" "$BED/33_fails_on_a_second_run.sql" "$BED/32_never_runs.sql")"
says "a second run that fails says re-applying" "FAILED re-applying $BED/33_fails_on_a_second_run.sql" "$out"
says "a second run's error names its file" "psql:$BED/33_fails_on_a_second_run.sql:1: ERROR:  relation \"bed_apply_once\" already exists" "$out"

out="$(fails "$BED/34_ends_inside_a_string.sql" "$BED/32_never_runs.sql")"
says "a file that ends inside a string fails as itself" "FAILED applying $BED/34_ends_inside_a_string.sql" "$out"
says "and the error names that file" "psql:$BED/34_ends_inside_a_string.sql:" "$out"

# Only the first file reaches psql, which then ends with no error, so the run must still fail.
cut_short() { (
  psql_as() { local user="$1"; shift; head -n 4 | docker exec -i -e PGPASSWORD=pg "$NAME" psql -U "$user" -h localhost -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
  fails "$@"
); }
out="$(cut_short "$BED/30_runs_before_the_failure.sql" "$BED/32_never_runs.sql")"
says "a run cut short fails and says where it stopped" "FAILED applying $BED/30_runs_before_the_failure.sql" "$out"
says "and says psql gave no error" "psql stopped there with no error" "$out"
same "and the file after the cut never ran" "$(ran)" "10 15 15 16 20 30 31 30"

no_psql() { (
  psql_as() { echo "no container here" >&2; return 2; }
  fails "$@"
); }
out="$(no_psql "$BED/32_never_runs.sql")"
says "a run that never reached psql says so" "FAILED reaching psql" "$out"
says "and gives what it heard" "no container here" "$out"

pgtest_apply "$BED/35_quits_psql.sql" "$BED/36_runs_after_a_quit.sql"
same "a \\q ends only its own file, and the next file runs" "$(ran)" "10 15 15 16 20 30 31 30 35 36"

# A container labelled as the leg's migrated copy, created and never started: the label is all pgtest_migrate reads
# before it decides. A copy of these files applies nothing, so its psql_as must never run.
copy_labelled() { docker rm -f "$NAME-copy" >/dev/null 2>&1 || true; docker create --name "$NAME-copy" --label "pgtest.migrated=$1" "$IMAGE" >/dev/null; }
migrate_in_copy() { NAME="$NAME-copy"; psql_as() { echo "psql_as ran"; return 1; }; pgtest_migrate; }
copy_labelled "$(pgtest_migrated_mark)"
same "a copy of these files applies nothing" "$( (migrate_in_copy) 2>&1)" "migrations: from the leg's migrated copy"
copy_labelled "a-copy-of-other-files"
out="$( (migrate_in_copy) 2>&1 && echo "it passed")" || true
says "a copy of other files is refused" "FAILED: $NAME-copy was made from a migrated copy of other files" "$out"
docker rm -f "$NAME-copy" >/dev/null

echo "bed-apply bed ok"
