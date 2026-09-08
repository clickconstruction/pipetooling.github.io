"""twinenv.py — where the twin toolkit finds its settings (stdlib only).

Nothing secret is stored in the repo:
  * Supabase URL + publishable (anon) key come from the nearest `.env.local`
    (walk up from the current directory, then from this file), falling back to
    the linked prod project so a bare checkout still works for reads.
  * The per-twin key is read from $TWIN_TOKEN_FILE (default
    ~/pt-twin-digest/twin.token). Never print it.
  * The dev-login secret (staff-side scripts only) is VITE_DEV_LOGIN_SECRET in
    `.env.local`; scripts that need it say so and exit if it is missing.
"""
import os
import sys

_DEFAULT_URL = "https://yewfzhbofbbyvkvtaatw.supabase.co"


def _find_env_local() -> str | None:
    starts = [os.getcwd(), os.path.dirname(os.path.abspath(__file__))]
    for start in starts:
        d = start
        for _ in range(8):
            p = os.path.join(d, ".env.local")
            if os.path.isfile(p):
                return p
            parent = os.path.dirname(d)
            if parent == d:
                break
            d = parent
    return None


def _env_local() -> dict[str, str]:
    out: dict[str, str] = {}
    p = _find_env_local()
    if not p:
        return out
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def supabase_url() -> str:
    return os.environ.get("VITE_SUPABASE_URL") or _env_local().get("VITE_SUPABASE_URL") or _DEFAULT_URL


def anon_key() -> str:
    k = os.environ.get("VITE_SUPABASE_ANON_KEY") or _env_local().get("VITE_SUPABASE_ANON_KEY")
    if not k:
        sys.exit("VITE_SUPABASE_ANON_KEY not found — run from the repo (it lives in .env.local)")
    return k


def twin_token() -> str:
    path = os.environ.get("TWIN_TOKEN_FILE") or os.path.expanduser("~/pt-twin-digest/twin.token")
    try:
        tok = open(path, encoding="utf-8").read().strip()
    except OSError:
        sys.exit(f"no twin key at {path} — issue one at Settings → Digital twins → Issue key, save it there (chmod 600)")
    if not tok:
        sys.exit(f"twin key file {path} is empty")
    return tok


def dev_login_secret() -> str:
    s = os.environ.get("VITE_DEV_LOGIN_SECRET") or _env_local().get("VITE_DEV_LOGIN_SECRET")
    if not s:
        sys.exit("VITE_DEV_LOGIN_SECRET not found in .env.local — this script acts as staff (dev seat)")
    return s
