#!/bin/bash
# Postgres logs through the Supabase Management API (read-only) — works when the MCP server
# is not authorized in a session. Needs SUPABASE_MGMT_TOKEN in .env.local (or the env).
#
#   scripts/pg-logs.sh <iso_start> <iso_end> [regex] [limit]
#   scripts/pg-logs.sh 2026-09-06T20:20:00Z 2026-09-06T22:10:00Z '(?i)terminat|not properly shut down|starting PostgreSQL'
#
# The regex is BigQuery RE2 syntax (the logs explorer dialect). Ranges over ~1 day sometimes
# return "Backend error! Retry your query." — narrow the window and retry.
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-yewfzhbofbbyvkvtaatw}"
if [ -z "${SUPABASE_MGMT_TOKEN:-}" ] && [ -f .env.local ]; then
  SUPABASE_MGMT_TOKEN="$(grep '^SUPABASE_MGMT_TOKEN=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
fi
[ -n "${SUPABASE_MGMT_TOKEN:-}" ] || { echo "SUPABASE_MGMT_TOKEN missing (.env.local or env)" >&2; exit 2; }
START="${1:?iso_start}"; END="${2:?iso_end}"; RE="${3:-.}"; LIM="${4:-200}"
SQL="select id, timestamp, event_message, m.parsed[0].error_severity as severity from postgres_logs cross join unnest(metadata) m where regexp_contains(event_message, '$RE') order by timestamp desc limit $LIM"
curl -s --max-time 90 -G "https://api.supabase.com/v1/projects/$REF/analytics/endpoints/logs.all" \
  -H "Authorization: Bearer $SUPABASE_MGMT_TOKEN" \
  --data-urlencode "iso_timestamp_start=$START" --data-urlencode "iso_timestamp_end=$END" --data-urlencode "sql=$SQL" \
| python3 -c '
import json,sys,datetime
d=json.load(sys.stdin)
if "error" in d: print("ERROR:", str(d["error"])[:500]); sys.exit(1)
rows=d.get("result",[]); print("rows:", len(rows), file=sys.stderr)
for r in sorted(rows, key=lambda r: r["timestamp"]):
    ts=r["timestamp"]
    if not isinstance(ts,str): ts=datetime.datetime.fromtimestamp(ts/1e6, datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(ts, (r.get("severity") or "-"), (r["event_message"] or "").replace("\n"," "))
'
