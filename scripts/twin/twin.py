#!/usr/bin/env python3
"""twin.py — call one twin-mcp verb from the shell (stdlib only).

    python3 scripts/twin/twin.py <tool> ['<json arguments>'] [--raw]

Examples:
    python3 scripts/twin/twin.py get_brief
    python3 scripts/twin/twin.py get_shadow_queue '{"days": 30}'
    python3 scripts/twin/twin.py lock_shadow '{"bid": "b482", "total": 148250}'

Auth: the per-twin key is read from $TWIN_TOKEN_FILE (default
~/pt-twin-digest/twin.token) and sent as X-Twin-Token. The value is never
printed — reference it by path in transcripts. Issue a key at Settings →
Digital twins → Issue key (shown once); revoke it there to cut a machine off.

Run this from the Claude sandbox or a stock python3 — the user's Homebrew
python 3.13 fails TLS to supabase.co on this machine (see docs/twins/TWIN_HARNESS.md).
"""
import json
import os
import sys
import urllib.error
import urllib.request

from twinenv import supabase_url, twin_token


def call(tool: str, args: dict | None = None, raw: bool = False) -> dict:
    body = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": tool, "arguments": args or {}},
    }).encode()
    req = urllib.request.Request(
        f"{supabase_url()}/functions/v1/twin-mcp",
        data=body,
        headers={"X-Twin-Token": twin_token(), "Content-Type": "application/json"},
    )
    try:
        resp = json.load(urllib.request.urlopen(req, timeout=180))
    except urllib.error.HTTPError as e:
        return {"error": {"http": e.code, "body": e.read().decode()[:500]}}
    if raw:
        return resp
    if "error" in resp:
        return {"error": resp["error"]}
    r = resp.get("result", {})
    text = "\n".join(c.get("text", "") for c in r.get("content", []) if isinstance(c, dict))
    return {"isError": bool(r.get("isError")), "text": text}


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    tool = sys.argv[1]
    raw = "--raw" in sys.argv
    args = {}
    if len(sys.argv) > 2 and not sys.argv[2].startswith("--"):
        args = json.loads(sys.argv[2])
    out = call(tool, args, raw)
    if raw:
        print(json.dumps(out, indent=1))
        return 0
    if "error" in out:
        print("RPC ERROR:", json.dumps(out["error"]))
        return 2
    if out["isError"]:
        print("TOOL ERROR:")
    print(out["text"])
    return 1 if out["isError"] else 0


if __name__ == "__main__":
    sys.exit(main())
