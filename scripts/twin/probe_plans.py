#!/usr/bin/env python3
"""probe_plans.py — "plans readable by robots": sweep or check one bid (stdlib only).

    python3 scripts/twin/probe_plans.py                 # sweep: never-probed or >24h-old live bids (max 100)
    python3 scripts/twin/probe_plans.py --force         # re-probe every live bid with a plans link
    python3 scripts/twin/probe_plans.py --bid b482      # one bid, records the verdict on it

Talks to the plan-fetch edge function's probe modes (v2.3080) with the twin key.
A Drive 404 means the file is not shared with the intake service account
(drive-intake@pipetooling-drive.iam.gserviceaccount.com); a folder link means
the PDF itself should be linked. Unreadable bids show a red ✕ robot icon on the
Bid Board and are skipped by the shadow dispatcher until the next probe clears them.
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

from twinenv import supabase_url, twin_token


def probe(query: dict) -> dict:
    url = f"{supabase_url()}/functions/v1/plan-fetch?{urllib.parse.urlencode(query)}"
    req = urllib.request.Request(url, headers={"X-Twin-Token": twin_token()})
    try:
        return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}", "body": e.read().decode()[:400]}


def main() -> int:
    argv = sys.argv[1:]
    if "--bid" in argv:
        bid = argv[argv.index("--bid") + 1]
        r = probe({"bid": bid, "probe": "1"})
        print(json.dumps(r, indent=1))
        return 0 if r.get("readable") else 1
    q = {"probe": "all", "limit": "100"}
    if "--force" in argv:
        q["force"] = "1"
    r = probe(q)
    if "error" in r:
        print(json.dumps(r, indent=1))
        return 2
    print(f"probed {r.get('probed', 0)} · readable {r.get('readable', 0)} · unreadable {len(r.get('unreadable', []))}")
    for u in r.get("unreadable", []):
        print(f"  {u['bid']:6} {str(u.get('project') or '')[:40]:40} {u.get('note') or ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
