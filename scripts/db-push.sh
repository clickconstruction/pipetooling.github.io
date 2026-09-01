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
echo Y | supabase db push --linked
npm run gen-types:linked
npm run check:migration-drift
