#!/bin/bash
# Deploy one or more edge functions to prod. The sanctioned counterpart to
# db-push.sh (see CLAUDE.md — edge functions deploy manually). Reads the
# management token from .env.local (no secrets in this file).
#
#   bash scripts/deploy-functions.sh <function-name> [more-names…]
#
# Every function deploys with --no-verify-jwt: gateway-level JWT verification
# is off repo-wide by convention — functions that need auth do their own
# auth.getUser() gating (and create-user RELIES on no gateway check;
# config.toml pins it). This matches how deploys have been run by hand.
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "usage: bash scripts/deploy-functions.sh <function-name> [more-names…]" >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo "error: .env.local not found — run from the repo root (or a worktree with .env.local copied in)" >&2
  exit 1
fi

set -a
source .env.local
set +a
export SUPABASE_ACCESS_TOKEN="$SUPABASE_MGMT_TOKEN"

for fn in "$@"; do
  if [ ! -d "supabase/functions/$fn" ]; then
    echo "error: supabase/functions/$fn does not exist" >&2
    exit 1
  fi
  supabase functions deploy "$fn" --no-verify-jwt --project-ref yewfzhbofbbyvkvtaatw
done
npm run check:edge-drift || true
