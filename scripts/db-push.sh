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
# The dev-mcp catalog is generated from database.ts: a types PR without it fails devMcpCatalog.test.ts.
node scripts/build-dev-mcp-catalog.mjs
npm run check:migration-drift
# A deploy that check:calls-ahead held (the client called what only a pending migration
# created — deploy.yml, v2.6119) runs again now that the push landed; any other failed
# deploy of main is re-run the same way, which costs a build and nothing else.
if command -v gh >/dev/null 2>&1; then
  last=$(gh run list --workflow deploy.yml --branch main --limit 1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || true)
  if [ "$last" = "failure" ]; then
    echo "the last deploy of main failed (held by check:calls-ahead, or another cause): re-running it"
    gh workflow run deploy.yml --ref main || echo "warning: could not re-run the deploy; run: gh workflow run deploy.yml --ref main" >&2
  fi
fi
