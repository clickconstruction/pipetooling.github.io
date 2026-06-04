#!/usr/bin/env bash
# CI guard for supabase/migrations — catches the history footguns that have bitten
# this repo before they reach `main`. Offline + deterministic (no network/token):
#   1. Every migration filename is <14-digit-timestamp>_snake_case.sql
#   2. No two migrations share the same version (timestamp) prefix — a duplicate
#      version makes `supabase db push` silently skip one file.
#
# It does NOT check remote drift (that needs the linked access token). For that,
# run `supabase migration list` locally; see AGENTS.md "Migration history drift".
set -euo pipefail

MIG_DIR="supabase/migrations"
fail=0

names=$(cd "$MIG_DIR" && ls -1 ./*.sql 2>/dev/null | sed 's#^\./##' || true)

# 1. Filename format
bad=$(printf '%s\n' "$names" | grep -vE '^[0-9]{14}_[a-z0-9_]+\.sql$' || true)
if [ -n "${bad//[$'\n']/}" ]; then
  echo "::error::Migration filenames must be <14-digit-timestamp>_snake_case.sql. Offenders:"
  printf '%s\n' "$bad" | sed 's/^/  /'
  fail=1
fi

# 2. Duplicate version (timestamp) prefixes
dups=$(printf '%s\n' "$names" | grep -oE '^[0-9]{14}' | sort | uniq -d || true)
if [ -n "${dups//[$'\n']/}" ]; then
  echo "::error::Two or more migrations share a version prefix (one would be silently skipped by 'supabase db push'):"
  printf '%s\n' "$dups" | sed 's/^/  /'
  echo "  Fix: give each migration a unique timestamp — create new ones with 'supabase migration new ...'."
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "Migration check FAILED."
  exit 1
fi
echo "Migration check OK: $(printf '%s\n' "$names" | grep -c . ) files, unique versions, valid names."
