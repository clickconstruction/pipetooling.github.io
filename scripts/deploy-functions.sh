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

# The CLI bundles with Docker by default, which pulls the edge-runtime image on
# a cold machine and sat for sixteen minutes on one function (2026-11-03).
# Bundling server-side through the API needs no daemon and no image: it is the
# default here. DEPLOY_WITH_DOCKER=1 keeps the old path for a machine that wants it.
bundle="--use-api"
[ "${DEPLOY_WITH_DOCKER:-}" = "1" ] && bundle=""
for fn in "$@"; do
  if [ ! -d "supabase/functions/$fn" ]; then
    echo "error: supabase/functions/$fn does not exist" >&2
    exit 1
  fi
  supabase functions deploy "$fn" --no-verify-jwt --project-ref yewfzhbofbbyvkvtaatw $bundle
done
npm run check:edge-drift || true
