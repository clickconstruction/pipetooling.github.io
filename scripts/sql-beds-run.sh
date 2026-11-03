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
#
# A bed that starts with pgtest_migrate begins from the leg's migrated copy (pgtest_make_copy, scripts/pgtest-pull.sh):
# the leg applies the migrations once, in its first slot, and those beds wait for the copy while the others run. A copy
# that fails leaves each of them to apply the migrations itself, so a broken migration still fails every bed by name.
# PGTEST_LEG_COPY=0 turns the copy off (v2.6415).
set -euo pipefail
cd "$(dirname "$0")/.."

AT_ONCE="${PGTEST_AT_ONCE:-8}"
BED_SECONDS="${PGTEST_BED_SECONDS:-1200}"
# Below Linux's ephemeral range (32768 up), so no outbound connection on the machine can be holding one of these.
FIRST_PORT=25000
TAIL_LINES=40
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
LEG_COPY="${PGTEST_LEG_COPY:-1}"
COPY_NAME="pgtest-leg-copy-$$"
COPY_IMAGE="pgtest-leg-copy:$$"

# A leg with nothing to run must not read as passed.
[ "$#" -gt 0 ] || { echo "no beds given"; exit 2; }
beds=("$@")

# Two beds with one container NAME would remove each other's container, so a copied bed fails here, in every leg.
dup="$(grep -h '^NAME=' scripts/pgtest-*.sh | sort | uniq -d)"
[ -z "$dup" ] || { echo "beds share a container name: $dup"; exit 2; }

LOGS="$(mktemp -d "${TMPDIR:-/tmp}/sql-beds.XXXXXX")"
trap 'rm -rf "$LOGS"; docker rm -f "$COPY_NAME" >/dev/null 2>&1 || true; docker rmi "$COPY_IMAGE" >/dev/null 2>&1 || true' EXIT

any_bed_names() {
  local bed
  for bed in "${beds[@]}"; do grep -qs -- "$1" "scripts/pgtest-$bed.sh" && return 0; done
  return 1
}
# A pull that fails here is not the end: each bed still tries its own and reports under its own name.
. scripts/pgtest-pull.sh
if any_bed_names supabase/postgres:; then pgtest_pull_supabase "$PGTEST_SUPABASE_TAG" || true; fi
if any_bed_names postgres:15; then pgtest_pull_postgres15 || true; fi

# The beds that can start from the leg's copy run last, so the others start while it is made.
uses_copy() { [ "$LEG_COPY" = 1 ] && grep -qE '^[[:space:]]*pgtest_migrate[[:space:]]*$' "scripts/pgtest-$1.sh"; }
order=() copy_beds=0
for bed in "${beds[@]}"; do if ! uses_copy "$bed"; then order+=("$bed"); fi; done
for bed in "${beds[@]}"; do if uses_copy "$bed"; then order+=("$bed"); copy_beds=$((copy_beds + 1)); fi; done

# The .done files appear whole, by rename, so the loop below never reads half a result.
run_bed() {
  local bed="$1" port="$2" image="$3" began=$SECONDS rc=0 envs
  envs=(PGTEST_PORT="$port")
  [ -z "$image" ] || envs+=(PGTEST_SUPABASE_IMAGE="$image")
  env "${envs[@]}" timeout -k 30 "$BED_SECONDS" bash "scripts/pgtest-$bed.sh" </dev/null >"$LOGS/$bed.log" 2>&1 || rc=$?
  echo "$rc $((SECONDS - began))" >"$LOGS/$bed.tmp"
  mv "$LOGS/$bed.tmp" "$LOGS/$bed.done"
}
make_copy() {
  local began=$SECONDS rc=0
  timeout -k 30 "$BED_SECONDS" bash -euo pipefail -c '. scripts/pgtest-pull.sh; pgtest_make_copy "$@"' _ \
    "$COPY_NAME" "${PGTEST_SUPABASE_IMAGE:-$PGTEST_SUPABASE_TAG}" "$COPY_IMAGE" </dev/null >"$LOGS/copy.log" 2>&1 || rc=$?
  echo "$rc $((SECONDS - began))" >"$LOGS/copy.tmp"
  mv "$LOGS/copy.tmp" "$LOGS/copy.done"
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

# A failed copy is a warning, not a failure: its beds apply the migrations themselves and fail on their own.
report_copy() {
  local rc="$1" secs="$2" word=made
  [ "$rc" = 0 ] || word="FAILED (exit $rc)"
  [ "$rc" != 124 ] || word="FAILED (stopped at the limit)"
  echo "::group::the leg's migrated copy: $word in $secs s, for $copy_beds beds"
  cat "$LOGS/copy.log"
  echo "::endgroup::"
  echo "| the leg's migrated copy | $word | $secs |" >>"$LOGS/table"
  copy_slot=0
  if [ "$rc" = 0 ]; then copy=made; return 0; fi
  copy=failed
  echo "::warning title=No migrated copy::the leg's migrated copy: $word, so each of its $copy_beds beds applies the migrations itself"
  echo "--- the last $TAIL_LINES lines of the copy's log ---"
  tail -n "$TAIL_LINES" "$LOGS/copy.log"
}

copy=none copy_slot=0
if [ "$copy_beds" -gt 0 ]; then
  echo "start: the leg's migrated copy, for $copy_beds beds"
  make_copy &
  copy=making copy_slot=1
fi

# Only this loop prints, so one bed's log never lands inside another's. The copy takes a slot while it is made.
started=0 reported=0
while [ "$reported" -lt "${#beds[@]}" ]; do
  if [ "$copy" = making ] && [ -f "$LOGS/copy.done" ]; then
    read -r rc secs <"$LOGS/copy.done"
    rm "$LOGS/copy.done"
    report_copy "$rc" "$secs"
  fi
  while [ "$started" -lt "${#order[@]}" ] && [ $((started - reported + copy_slot)) -lt "$AT_ONCE" ]; do
    bed="${order[$started]}" image="" from=""
    if uses_copy "$bed"; then
      [ "$copy" != making ] || break
      [ "$copy" != made ] || { image="$COPY_IMAGE"; from=", from the leg's copy"; }
    fi
    echo "start: $bed on port $((FIRST_PORT + started))$from"
    run_bed "$bed" $((FIRST_PORT + started)) "$image" &
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
