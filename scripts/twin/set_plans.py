#!/usr/bin/env python3
"""set_plans.py — repoint a ROBOT shell's plans link (ZZ bids only; stdlib only).

    python3 scripts/twin/set_plans.py b482 'https://drive.google.com/file/d/<id>/view'          # dry run
    python3 scripts/twin/set_plans.py b482 'https://drive.google.com/file/d/<id>/view' --apply

Refuses any bid whose project name does not start with "ZZ " — a human bid's
plans link is the estimator's record; ask them to fix it (or use the Bid Board
edit form as staff). Acts as the twin (its own shells); runs a probe afterwards
so the Bid Board icon and the dispatcher see the new link immediately.
"""
import subprocess
import sys
import os

from twinrest import jwt_as_twin, rest


def main() -> int:
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply = "--apply" in sys.argv
    if len(argv) != 2:
        print(__doc__)
        return 2
    bid_no, url = argv[0].lstrip("bB"), argv[1]
    jwt = jwt_as_twin()
    rows = rest(jwt, "GET", f"bids?select=id,bid_number,project_name,plans_link&bid_number=eq.{bid_no}")
    if not rows or isinstance(rows, dict):
        sys.exit(f"b{bid_no} not found or not visible to the twin: {rows}")
    r = rows[0]
    if not str(r.get("project_name") or "").startswith("ZZ "):
        sys.exit("refusing: only ZZ robot shells may be repointed here — a human bid's plans link is the estimator's record")
    print(f"b{bid_no} {r['project_name']}\n  old: {r.get('plans_link')}\n  new: {url}")
    if not apply:
        print("Dry run — add --apply")
        return 0
    out = rest(jwt, "PATCH", f"bids?id=eq.{r['id']}", {"plans_link": url})
    if not out or isinstance(out, dict):
        sys.exit(f"update refused (twin write fence?): {out}")
    print("plans_link updated; probing…")
    here = os.path.dirname(os.path.abspath(__file__))
    subprocess.run([sys.executable, os.path.join(here, "probe_plans.py"), "--bid", f"b{bid_no}"], check=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
