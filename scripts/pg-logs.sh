#!/bin/bash
# Postgres logs through the Supabase Management API (read-only) — works when the MCP server
# is not authorized in a session. Needs SUPABASE_MGMT_TOKEN in .env.local (or the env).
#
#   scripts/pg-logs.sh <iso_start> <iso_end> [regex] [limit]
#   scripts/pg-logs.sh 2026-09-06T20:20:00Z 2026-09-06T22:10:00Z '(?i)terminat|not properly shut down|starting PostgreSQL'
#
# The times are UTC and end in Z (the endpoint refuses +hh:mm offsets); the output times are UTC too.
#
# The endpoint is .../analytics/endpoints/logs (logs.all is gone): ClickHouse SQL over one `logs`
# table that holds every service's lines, told apart by `source`. The script reads source =
# 'postgres_logs', the only source with the server's own lines (the poolers, PostgREST and Auth
# have their own). `select *` is refused, so it names timestamp (UTC), severity_text and
# event_message. The regex is RE2 (ClickHouse match).
#
# The endpoint cuts a result without saying so, so the script refuses what it cannot read whole:
# a window over 24 hours (it reads 24 hours from iso_start) and a limit over 1000 (its row cap).
# It allows 10 calls a minute; a 429 means wait a minute and retry.
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-yewfzhbofbbyvkvtaatw}"
if [ -z "${SUPABASE_MGMT_TOKEN:-}" ] && [ -f .env.local ]; then
  SUPABASE_MGMT_TOKEN="$(grep '^SUPABASE_MGMT_TOKEN=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true)"
fi
[ -n "${SUPABASE_MGMT_TOKEN:-}" ] || { echo "SUPABASE_MGMT_TOKEN missing (.env.local or env)" >&2; exit 2; }
START="${1:?iso_start}"; END="${2:?iso_end}"; RE="${3:-.}"; LIM="${4:-200}"
case "$LIM" in ''|*[!0-9]*) echo "limit must be a whole number" >&2; exit 2 ;; esac
if [ "${#LIM}" -gt 6 ] || [ "$((10#$LIM))" -gt 1000 ]; then
  echo "limit is over 1000, the most rows the endpoint returns: narrow the window or the regex" >&2; exit 2
fi
LIM=$((10#$LIM))
python3 - "$START" "$END" <<'PY' || exit 2
import sys
from datetime import datetime
def at(s):
    try: d = datetime.fromisoformat(s[:-1] + "+00:00") if s.endswith("Z") else None
    except ValueError: d = None
    if d is None: sys.exit("iso_start and iso_end must be UTC times ending in Z, like 2026-09-06T20:20:00Z (the endpoint refuses offsets)")
    return d
a, b = at(sys.argv[1]), at(sys.argv[2])
if b <= a: sys.exit("iso_end must be after iso_start")
if (b - a).total_seconds() > 86400: sys.exit("that window is over 24 hours and the endpoint reads only the first 24 hours from iso_start: run one call per day")
PY
# The endpoint reads the escapes in a string literal twice (\d reaches the regex as d), so the regex
# goes in as hex and unhex() turns it back: whatever the regex holds arrives exactly as typed.
RE_HEX="$(printf '%s' "$RE" | od -An -v -tx1 | tr -d ' \n')"
SQL="select timestamp, severity_text, event_message from logs where source = 'postgres_logs' and match(event_message, unhex('$RE_HEX')) order by timestamp desc limit $LIM"
curl -s --max-time 90 -G "https://api.supabase.com/v1/projects/$REF/analytics/endpoints/logs" \
  -H "Authorization: Bearer $SUPABASE_MGMT_TOKEN" \
  --data-urlencode "iso_timestamp_start=$START" --data-urlencode "iso_timestamp_end=$END" --data-urlencode "sql=$SQL" \
| python3 -c '
import json,sys
raw=sys.stdin.read()
try: d=json.loads(raw)
except ValueError: print("ERROR: no JSON back from the endpoint:", raw[:300].replace("\n"," ") or "(empty, curl timed out or could not connect)", file=sys.stderr); sys.exit(1)
if "result" not in d:  # a refused query is {"error"}; a refused call (401, 429) is {"message"}
    msg=str(d.get("error") or d.get("message") or d)[:500]
    if "Too Many Requests" in msg: msg+=" (10 calls a minute: wait a minute and retry)"
    print("ERROR:", msg, file=sys.stderr); sys.exit(1)
rows=d["result"]; print("rows:", len(rows), file=sys.stderr)
for r in sorted(rows, key=lambda r: r["timestamp"]):
    print(r["timestamp"][:19].replace("T"," "), (r.get("severity_text") or "-"), (r["event_message"] or "").replace("\n"," "))
if len(rows)==int(sys.argv[1]): print("rows hit the limit, so older matches are cut: narrow the window or the regex", file=sys.stderr)
' "$LIM"
