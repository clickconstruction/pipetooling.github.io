#!/bin/bash
# Deploy one or more edge functions to prod. The sanctioned counterpart to
# db-push.sh (see CLAUDE.md — edge functions deploy manually). Reads the
# management token from .env.local (no secrets in this file).
#
#   bash scripts/deploy-functions.sh <function-name> [more-names…]
#
# dev-mcp is the one function that does not deploy from this machine (v2.8117):
# it deploys bundled, from main, by the `dev-mcp-deploy.yml` job, which this
# script dispatches and waits for. See `deploy_seat` below.
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

# dev-mcp deploys bundled, from CI (v2.8117). Raw files are held to 5 MB by Supabase and a bundle built with Docker to
# 20 MB; the seat passed 4.49 MB of raw files on 2026-11-20, and this Mac's Docker daemon belongs to another account.
# So the seat's deploy is a job on a hosted runner: main alone, dev-mcp alone. This dispatches it, waits and prints
# what the CLI said. The job deploys origin/main, never this checkout. DEPLOY_DEV_MCP_RAW=1 sends raw files from here
# as before, for a day GitHub cannot run the job and the seat is still under 5 MB.
SEAT_WORKFLOW="dev-mcp-deploy.yml"
deploy_seat() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "error: dev-mcp deploys through GitHub (gh workflow run $SEAT_WORKFLOW --ref main), and gh is not installed" >&2
    return 1
  fi
  git fetch origin main --quiet || true
  echo "dev-mcp deploys bundled from CI: main at $(git rev-parse --short=10 origin/main) ($(git log -1 --format=%s origin/main | cut -c1-80))"
  if ! git diff --quiet origin/main -- supabase/functions/dev-mcp supabase/functions/_shared 2>/dev/null; then
    echo "note: this checkout's supabase/functions differs from origin/main. The job deploys main, not this checkout."
  fi
  local before id="" newer conclusion i hop
  before=$(gh run list --workflow "$SEAT_WORKFLOW" --limit 1 --json databaseId --jq '.[0].databaseId // 0')
  gh workflow run "$SEAT_WORKFLOW" --ref main
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    sleep 5
    id=$(gh run list --workflow "$SEAT_WORKFLOW" --event workflow_dispatch --limit 5 --json databaseId \
      --jq "[.[] | select(.databaseId > ${before:-0})] | last | .databaseId // empty")
    [ -n "$id" ] && break
  done
  if [ -z "$id" ]; then
    echo "error: the run did not show up within a minute; look with: gh run list --workflow $SEAT_WORKFLOW" >&2
    return 1
  fi
  # One run waits at a time: a newer dispatch replaces a waiting one and deploys the same main or a newer one.
  for hop in 1 2 3; do
    echo "waiting for $(gh run view "$id" --json url --jq .url)"
    gh run watch "$id" --interval 10 >/dev/null 2>&1 || true
    conclusion=$(gh run view "$id" --json conclusion --jq .conclusion)
    [ "$conclusion" = "cancelled" ] || break
    newer=$(gh run list --workflow "$SEAT_WORKFLOW" --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
    [ -n "$newer" ] && [ "$newer" != "$id" ] || break
    echo "run $id was replaced by run $newer, which deploys the same main or a newer one"
    id=$newer
  done
  gh run view "$id" --log 2>/dev/null | grep -E 'script size|Deployed Functions on project|exceeds|##\[error\]' | sed -E 's/^.*[0-9]Z //' || true
  if [ "$conclusion" != "success" ]; then
    echo "error: the dev-mcp deploy job ended $conclusion. The live seat is as it was unless a line above says Deployed." >&2
    return 1
  fi
}

seat=0
for fn in "$@"; do
  if [ ! -d "supabase/functions/$fn" ]; then
    echo "error: supabase/functions/$fn does not exist" >&2
    exit 1
  fi
  if [ "$fn" = "dev-mcp" ] && [ "${DEPLOY_DEV_MCP_RAW:-}" != "1" ]; then
    seat=1
    continue
  fi
  supabase functions deploy "$fn" --no-verify-jwt --project-ref yewfzhbofbbyvkvtaatw $bundle
done
if [ "$seat" = "1" ]; then deploy_seat; fi
npm run check:edge-drift || true
