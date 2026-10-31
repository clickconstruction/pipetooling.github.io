#!/usr/bin/env python3
"""redeem_setup_code.py — turn a twin setup code into this Mac's twin key (stdlib only).

    python3 scripts/twin/redeem_setup_code.py <code> [--rounds] [--token-file PATH]

The code comes from the dev seat's mint_twin_setup_code (a dev's agent asks for it) or from a
person pressing Settings → Digital twins → Set up on this Mac. Redeeming it mints the twin's key
server-side (twin-setup, action redeem) and returns it once, over TLS, to this machine; the script
writes it to $TWIN_TOKEN_FILE (default ~/pt-twin-digest/twin.token, mode 600), saves the kickoff
text beside it, and prints the twin, the label and the connector — never the key. A code is
single-use and lasts ten minutes; a miss says nothing about why.

After it: python3 scripts/twin/twin.py get_brief answers, /bid bNNN runs, and
bash scripts/twin-session.sh starts a Code session with the twin-mcp connector live.
Revoke the key by its label at Settings → Digital twins.
"""
import argparse
import json
import os
import socket
import sys
import urllib.error
import urllib.request

from twinenv import supabase_url


def main() -> None:
    ap = argparse.ArgumentParser(description="Redeem a twin setup code into this Mac's key file.")
    ap.add_argument("code", help="the ten-character setup code (dashes and spaces are fine)")
    ap.add_argument("--rounds", action="store_true", help="ask for the rounds kickoff (a Mac that stays on)")
    ap.add_argument("--token-file", default=os.environ.get("TWIN_TOKEN_FILE") or os.path.expanduser("~/pt-twin-digest/twin.token"))
    a = ap.parse_args()

    code = "".join(ch for ch in a.code.upper() if ch.isalnum())
    body = json.dumps({"action": "redeem", "code": code, "machine": socket.gethostname(), "rounds": bool(a.rounds)}).encode()
    req = urllib.request.Request(
        f"{supabase_url()}/functions/v1/twin-setup",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "pipetooling-twin-toolkit/1"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            reply = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode("utf-8")).get("error")
        except Exception:  # noqa: BLE001 — the body is whatever the gateway sent
            err = None
        sys.exit(f"twin-setup refused the code ({e.code}): {err or 'no reason given'} — mint a fresh one and try again")
    except (urllib.error.URLError, TimeoutError) as e:
        sys.exit(f"twin-setup could not be reached: {e}")

    token = reply.get("token")
    if not isinstance(token, str) or not token.strip():
        sys.exit("twin-setup returned no key — mint a fresh code and try again")

    path = a.token_file
    folder = os.path.dirname(path) or "."
    os.makedirs(folder, mode=0o700, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(fd, (token.strip() + "\n").encode("utf-8"))
    finally:
        os.close(fd)
    os.chmod(path, 0o600)
    del token

    kickoff = reply.get("kickoff")
    kickoff_path = None
    if isinstance(kickoff, str) and kickoff.strip():
        kickoff_path = os.path.join(folder, f"kickoff-{reply.get('kickoff_for') or reply.get('twin_kind') or 'twin'}.md")
        with open(kickoff_path, "w", encoding="utf-8") as f:
            f.write(kickoff)

    print(f"Key written to {path} (mode 600) for {reply.get('twin_email')} — label \"{reply.get('label')}\".")
    print(f"Connector: {reply.get('connector_name')} at {reply.get('connector_url')}")
    if kickoff_path:
        print(f"Kickoff ({reply.get('kickoff_for')}) saved to {kickoff_path}")
    print(f"Check: {reply.get('check_call') or 'call get_brief'} — e.g. python3 scripts/twin/twin.py get_brief")
    print("Revoke the key by its label at Settings → Digital twins.")


if __name__ == "__main__":
    main()
