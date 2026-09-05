#!/bin/sh
# Launch a Claude Code session with the twin-mcp connector authenticated.
#
# The repo's .mcp.json reads the per-twin key from $TWIN_ESTIMATOR_1_TOKEN, and
# MCP servers connect at session START — a session launched without the variable
# cannot repair the connector mid-flight (the HTTP fallback in TWIN_HARNESS.md
# still works, but tool-native is better). This launcher closes the machine-bound
# bootstrap gap found in the 2026-09-05 STG-5 backfill session: keep the key in a
# file once, then every session starts the same way on any machine.
#
#   bash scripts/twin-session.sh                # token from ~/pt-twin-digest/twin.token
#   TWIN_TOKEN_FILE=/path/to/key bash scripts/twin-session.sh
#   bash scripts/twin-session.sh --print-env    # just print the export line (for eval)
#
# Issue a key: Settings → System → Digital twins → Issue key (shown once; save it
# to the token file, chmod 600). Revoke it there to cut this machine off.

set -eu

TOKEN_FILE="${TWIN_TOKEN_FILE:-$HOME/pt-twin-digest/twin.token}"

if [ ! -s "$TOKEN_FILE" ]; then
  echo "twin-session: no key at $TOKEN_FILE" >&2
  echo "  Issue one: Settings → System → Digital twins → Issue key (shown once)," >&2
  echo "  then:      mkdir -p \"$(dirname "$TOKEN_FILE")\" && pbpaste > \"$TOKEN_FILE\" && chmod 600 \"$TOKEN_FILE\"" >&2
  exit 1
fi

TWIN_ESTIMATOR_1_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
export TWIN_ESTIMATOR_1_TOKEN

if [ "${1:-}" = "--print-env" ]; then
  echo "export TWIN_ESTIMATOR_1_TOKEN=\"\$(tr -d '[:space:]' < \"$TOKEN_FILE\")\""
  exit 0
fi

exec claude "$@"
