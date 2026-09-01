#!/bin/bash
# Apply pending migrations to prod + regenerate types. The one sanctioned way to
# apply DDL (see CLAUDE.md — never MCP apply_migration / SQL editor). Reads the
# management token + DB password from .env.local (no secrets in this file).
#
# Run from a checkout whose supabase/migrations is up to date with origin/main:
#   bash scripts/db-push.sh
set -euo pipefail

if [ ! -f .env.local ]; then
  echo "error: .env.local not found — run from the repo root (or a worktree with .env.local copied in)" >&2
  exit 1
fi

set -a
source .env.local
set +a
export SUPABASE_ACCESS_TOKEN="$SUPABASE_MGMT_TOKEN"

supabase link --project-ref yewfzhbofbbyvkvtaatw >/dev/null 2>&1 || true

# Plain push first; when a parallel session applied a migration stamped between
# our pending ones, the CLI refuses with "Rerun the command with --include-all"
# (the out-of-order case in AGENTS.md) — retry with the flag it asks for.
push_out=$(echo Y | supabase db push --linked 2>&1) && push_ok=true || push_ok=false
printf '%s\n' "$push_out"
if [ "$push_ok" != true ]; then
  if printf '%s' "$push_out" | grep -q -- '--include-all'; then
    echo "retrying with --include-all (out-of-order pending migrations)"
    echo Y | supabase db push --linked --include-all
  else
    exit 1
  fi
fi
npm run gen-types:linked
npm run check:migration-drift
