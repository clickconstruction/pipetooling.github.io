#!/usr/bin/env bash
# Capture Supabase Postgres inspect output for incident triage (linked project).
# Output is gitignored under docs/runbooks/supabase-inspect-snapshot/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$REPO_ROOT/docs/runbooks/supabase-inspect-snapshot/incident-$STAMP"

mkdir -p "$OUT"
cd "$REPO_ROOT"

echo "Writing Supabase inspect capture to:"
echo "  $OUT"
echo ""

run() {
  local name="$1"
  shift
  echo "=== $name ===" | tee "$OUT/${name}.txt"
  "$@" 2>&1 | tee -a "$OUT/${name}.txt" || true
  echo "" | tee -a "$OUT/${name}.txt"
}

run "01_projects_list" supabase projects list
run "02_blocking" supabase inspect db blocking --linked
run "03_locks" supabase inspect db locks --linked
run "04_long_running_queries" supabase inspect db long-running-queries --linked
run "05_outliers" supabase inspect db outliers --linked
run "06_calls" supabase inspect db calls --linked

echo "=== 07_inspect_report (CSVs in report/) ===" | tee "$OUT/07_inspect_report.txt"
supabase inspect report --linked --output-dir "$OUT/report" 2>&1 | tee -a "$OUT/07_inspect_report.txt" || true

echo ""
echo "Done. Attach this folder (or its contents) in chat:"
echo "  $OUT"
