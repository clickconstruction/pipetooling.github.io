#!/usr/bin/env python3
"""twinrest.py — signed-in REST/RPC calls against PipeTooling, as the twin or as dev.

    python3 scripts/twin/twinrest.py [--as twin|dev] get  '<path?query>'
    python3 scripts/twin/twinrest.py [--as twin|dev] patch '<path?filter>' '<json>'
    python3 scripts/twin/twinrest.py [--as twin|dev] post  '<path>' '<json>'
    python3 scripts/twin/twinrest.py [--as twin|dev] rpc   <function> ['<json>']

Examples:
    python3 scripts/twin/twinrest.py get 'bids?select=bid_number,project_name&bid_number=eq.482'
    python3 scripts/twin/twinrest.py rpc list_shadow_runs
    python3 scripts/twin/twinrest.py --as dev get 'users?select=id,name,calibration_standard&calibration_standard=eq.true'

How it signs in:
  --as twin (default): twin-mcp `mint_session` → follow the action link once with
      redirects disabled → JWT from the Location fragment. Writes stay inside the
      twin write fence (its own ZZ bids); RLS decides what it can read.
  --as dev: the `dev-login` edge function with VITE_DEV_LOGIN_SECRET from .env.local
      (the dev seat). Use for staff-side metadata (axis, holdout, plans repair on
      human bids is STILL off-limits — see set_plans.py).

Every call is one request; the JWT is minted fresh each run (they expire in hours).
Nothing secret is printed.
"""
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

from twinenv import anon_key, dev_login_secret, supabase_url, twin_token


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):  # noqa: D401
        return None


def _jwt_from_action_link(link: str) -> str:
    try:
        r = urllib.request.build_opener(_NoRedirect).open(link, timeout=60)
        loc = r.headers.get("Location")
    except urllib.error.HTTPError as e:
        loc = e.headers.get("Location")
    if not loc:
        sys.exit("sign-in link did not redirect — token expired or already used")
    frag = urllib.parse.parse_qs(urllib.parse.urlsplit(loc).fragment)
    tok = frag.get("access_token", [None])[0]
    if not tok:
        sys.exit("no access_token in the sign-in redirect")
    return tok


def jwt_as_twin() -> str:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": "mint_session", "arguments": {}}}).encode()
    req = urllib.request.Request(f"{supabase_url()}/functions/v1/twin-mcp", data=body,
                                 headers={"X-Twin-Token": twin_token(), "Content-Type": "application/json"})
    resp = json.load(urllib.request.urlopen(req, timeout=60))
    text = "".join(c.get("text", "") for c in resp.get("result", {}).get("content", []))
    m = re.search(r"https://\S+/auth/v1/verify\S*", text)
    link = m.group(0).rstrip('",)') if m else None
    if not link:
        try:
            link = json.loads(text).get("action_link")
        except Exception:  # noqa: BLE001
            pass
    if not link:
        sys.exit("mint_session returned no action link: " + text[:200])
    return _jwt_from_action_link(link)


def jwt_as_dev() -> str:
    # dev-login signs in the dev seat; DEV_LOGIN_EMAIL (env or .env.local) overrides.
    import os
    from twinenv import _env_local  # noqa: PLC0415
    email = os.environ.get("DEV_LOGIN_EMAIL") or _env_local().get("DEV_LOGIN_EMAIL") or "robert@douglasmining.com"
    body = json.dumps({"email": email, "redirectTo": f"{supabase_url()}/"}).encode()
    req = urllib.request.Request(f"{supabase_url()}/functions/v1/dev-login", data=body,
                                 headers={"X-Dev-Login-Secret": dev_login_secret(), "Content-Type": "application/json"})
    resp = json.load(urllib.request.urlopen(req, timeout=60))
    link = resp.get("action_link") or resp.get("url")
    if not link:
        sys.exit("dev-login returned no action link: " + json.dumps(resp)[:200])
    return _jwt_from_action_link(link)


def headers(jwt: str, write: bool = False) -> dict[str, str]:
    h = {"apikey": anon_key(), "Authorization": f"Bearer {jwt}"}
    if write:
        h["Content-Type"] = "application/json"
        h["Prefer"] = "return=representation"
    return h


def rest(jwt: str, method: str, path: str, body: dict | list | None = None):
    url = f"{supabase_url()}/rest/v1/{path.lstrip('/')}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers(jwt, write=body is not None))
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        return {"http": e.code, "body": e.read().decode()[:600]}


def main() -> int:
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    who = "twin"
    if argv[0] == "--as":
        who, argv = argv[1], argv[2:]
    if not argv:
        print(__doc__)
        return 2
    jwt = jwt_as_dev() if who == "dev" else jwt_as_twin()
    op = argv[0]
    if op == "get":
        out = rest(jwt, "GET", argv[1])
    elif op == "patch":
        out = rest(jwt, "PATCH", argv[1], json.loads(argv[2]))
    elif op == "post":
        out = rest(jwt, "POST", argv[1], json.loads(argv[2]))
    elif op == "rpc":
        out = rest(jwt, "POST", f"rpc/{argv[1]}", json.loads(argv[2]) if len(argv) > 2 else {})
    else:
        print(__doc__)
        return 2
    print(json.dumps(out, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
