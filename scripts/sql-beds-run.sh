#!/usr/bin/env bash
# Runs one leg of the SQL beds side by side on one machine: .github/workflows/sql-beds.yml calls it with the beds it
# dealt to the leg from scripts/sql-beds.txt.
#
#   bash scripts/sql-beds-run.sh gc-start walk-kit training
#
# It pulls each image once, so a bed's own pull finds it here, and gives every bed its own PGTEST_PORT, since the
# defaults collide. PGTEST_AT_ONCE beds (8) run at a time. PGTEST_BED_SECONDS (1200) stops a bed that hangs, so the
# leg names it and carries on. A failed bed never stops the others. As each bed ends it prints its name, result and
# seconds, with its whole log folded under that line and a failed bed's last lines in the open. The failures go to
# $GITHUB_STEP_SUMMARY, and it exits 1 when any bed failed. Needs docker. Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

AT_ONCE="${PGTEST_AT_ONCE:-8}"
BED_SECONDS="${PGTEST_BED_SECONDS:-1200}"
# Below Linux's ephemeral range (32768 up), so no outbound connection on the machine can be holding one of these.
FIRST_PORT=25000
TAIL_LINES=40
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

# A leg with nothing to run must not read as passed.
[ "$#" -gt 0 ] || { echo "no beds given"; exit 2; }
beds=("$@")

# Two beds with one container NAME would remove each other's container, so a copied bed fails here, in every leg.
dup="$(grep -h '^NAME=' scripts/pgtest-*.sh | sort | uniq -d)"
[ -z "$dup" ] || { echo "beds share a container name: $dup"; exit 2; }

LOGS="$(mktemp -d "${TMPDIR:-/tmp}/sql-beds.XXXXXX")"
trap 'rm -rf "$LOGS"' EXIT

any_bed_names() {
  local bed
  for bed in "${beds[@]}"; do grep -qs -- "$1" "scripts/pgtest-$bed.sh" && return 0; done
  return 1
}
# A pull that fails here is not the end: each bed still tries its own and reports under its own name.
. scripts/pgtest-pull.sh
if any_bed_names supabase/postgres:; then pgtest_pull_supabase "$PGTEST_SUPABASE_TAG" || true; fi
if any_bed_names postgres:15; then pgtest_pull_postgres15 || true; fi

# The .done file appears whole, by rename, so the loop below never reads half a result.
run_bed() {
  local bed="$1" port="$2" began=$SECONDS rc=0
  PGTEST_PORT="$port" timeout -k 30 "$BED_SECONDS" bash "scripts/pgtest-$bed.sh" </dev/null >"$LOGS/$bed.log" 2>&1 || rc=$?
  echo "$rc $((SECONDS - began))" >"$LOGS/$bed.tmp"
  mv "$LOGS/$bed.tmp" "$LOGS/$bed.done"
}

failed=0
report() {
  local bed="$1" rc="$2" secs="$3" log="$LOGS/$bed.log" word=passed
  [ "$rc" = 0 ] || word="FAILED (exit $rc)"
  [ "$rc" != 124 ] || word="FAILED (stopped at the limit)"
  echo "::group::$bed: $word in $secs s"
  cat "$log"
  echo "::endgroup::"
  echo "| $bed | $word | $secs |" >>"$LOGS/table"
  [ "$rc" != 0 ] || return 0
  failed=$((failed + 1))
  echo "::error title=SQL bed failed::$bed: $word in $secs s"
  echo "--- the last $TAIL_LINES lines of $bed's log ---"
  tail -n "$TAIL_LINES" "$log"
  {
    printf -- '- **%s**: %s in %s s\n\n<details><summary>Its last lines</summary>\n\n```text\n' "$bed" "$word" "$secs"
    tail -n "$TAIL_LINES" "$log"
    printf '\n```\n\n</details>\n\n'
  } >>"$LOGS/failures"
}

# Only this loop prints, so one bed's log never lands inside another's.
started=0 reported=0
while [ "$reported" -lt "${#beds[@]}" ]; do
  while [ "$started" -lt "${#beds[@]}" ] && [ $((started - reported)) -lt "$AT_ONCE" ]; do
    echo "start: ${beds[$started]} on port $((FIRST_PORT + started))"
    run_bed "${beds[$started]}" $((FIRST_PORT + started)) &
    started=$((started + 1))
  done
  for bed in "${beds[@]}"; do
    [ -f "$LOGS/$bed.done" ] || continue
    read -r rc secs <"$LOGS/$bed.done"
    rm "$LOGS/$bed.done"
    report "$bed" "$rc" "$secs"
    reported=$((reported + 1))
  done
  sleep 1
done
wait

echo "this leg: ${#beds[@]} beds, $failed failed, $SECONDS s"
{
  echo "$((${#beds[@]} - failed)) of ${#beds[@]} beds passed in $SECONDS s."
  echo
  if [ "$failed" -gt 0 ]; then cat "$LOGS/failures"; fi
  printf '<details><summary>Every bed</summary>\n\n| Bed | Result | Seconds |\n| --- | --- | ---: |\n'
  cat "$LOGS/table"
  printf '\n</details>\n'
} >>"$SUMMARY"
[ "$failed" -eq 0 ]
