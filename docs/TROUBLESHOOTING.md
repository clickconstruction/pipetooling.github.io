# PipeTooling Troubleshooting

Common issues and how to resolve them.

---

## White screen after app update

**Symptoms**: App shows a blank white screen even after hard reload. Often happens when the app was open during a deploy (e.g. phone left open).

**Cause**: Service worker or browser cache serving stale/corrupted assets.

**Solution**:
1. Navigate directly to **Fix app**: `https://yoursite.com/fix-cache.html` (replace with your app's base URL)
2. Click **Fix app**
3. The page will unregister service workers, clear caches, clear app localStorage, and reload

**Prevention**: Bookmark `/fix-cache.html` or use the link in Settings → Fix app.

---

## Supabase database unresponsive / high disk I/O

**Symptoms**: Supabase Dashboard slow or not loading table counts; "High Disk I/O" in metrics; app can't connect.

**Possible causes**:
- Paused project (free tier pauses after 7 days inactivity)
- Critical autovacuum (wraparound prevention) consuming resources
- Long-running or runaway queries
- Disk I/O budget depleted

**Solutions**:

### 1. Paused project
- Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
- **Project Settings** → **General**
- Click **Restore project** (or **Resume project**)
- Wait several minutes; you'll get an email when ready

### 2. Find and terminate long-running queries
In Supabase **SQL Editor**, run:
```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
  AND state != 'idle'
ORDER BY duration DESC;
```
To terminate a query: `SELECT pg_terminate_backend(<pid>);`

### 3. Critical autovacuum (cannot be stopped)
If a wraparound-prevention autovacuum is running, it cannot be terminated. Monitor progress:
```sql
SELECT relid::regclass AS table_name,
       round(100.0 * heap_blks_scanned / nullif(heap_blks_total, 0), 2) AS pct_scanned
FROM pg_stat_progress_vacuum;
```
Options: wait for it to finish, or temporarily upgrade compute to speed it up.

### 4. Upgrade compute
- **Project Settings** → **Compute and disk**
- Temporarily upgrade to a larger compute size for more disk throughput

### 5. Last resort: pause and restore
- **Project Settings** → **General** → **Pause project**
- After it pauses, click **Restore project**
- Causes downtime but can clear stuck state

---

## Cursor agents: “Supabase crashed” / outage triage

In this repo, **Cursor** loads **[`.cursor/rules/supabase-incident-triage.mdc`](../.cursor/rules/supabase-incident-triage.mdc)** (**always-on** for this project). Say things like **Help me figure out why Supabase crashed** or **Postgres was unhealthy** and the agent should run **`./scripts/capture-supabase-incident.sh`** (or equivalent **`supabase inspect db … --linked`**) and follow **`docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md`**. You still need **`supabase link`** (or MCP) on the machine running commands, and **Dashboard → Logs** export for the same UTC window when gateway/API errors dominate.

**Related:** **`RECENT_FEATURES.md`** **v2.454** — app-side Realtime/refetch mitigation (**`useDocumentVisibility`**, debounced financial pins, narrower **`clock_sessions`** subscriptions on Dashboard / People / Banking).

---

## Duplicate key error when pinning

**Error**: `duplicate key value violates unique constraint "user_pinned_tabs_user_path_tab_key"`

**Cause**: Trying to add a pin that already exists for that user/path/tab.

**Resolution**: The app now treats this as success (no error shown). If you still see it, ensure you're on the latest build. The `addPinForUser` function handles duplicate inserts gracefully.

---

## Imitate redirects to localhost instead of production

**Symptoms**: Clicking "imitate" on People or Settings (on pipetooling.com) redirects to `http://localhost:3000/#access_token=...` instead of the production URL.

**Cause**: Supabase Auth **Site URL** or **Redirect URLs** not configured for production. Magic links use the Site URL when the requested redirect is not in the allow list.

**Solution**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **Authentication** → **URL Configuration**
3. **Site URL**: Set to your production URL (e.g. `https://pipetooling.com`)
4. **Redirect URLs**: Add your production URL pattern, e.g. `https://pipetooling.com/**`
5. Save and try imitate again

**See also**: [login-as-user DEPLOY.md](../supabase/functions/login-as-user/DEPLOY.md) Step 3

---

## Password reset emails never arrive (500 "Error sending recovery email")

**Symptoms**: `/reset-password` shows success but no email arrives; the auth API returns `500 unexpected_failure` with "Error sending recovery email" (same for any email Supabase Auth itself must send).

**Cause**: Supabase Auth's mailer has no working SMTP behind it. App-sent emails (invite, sign-in link, notifications, estimates) are unaffected — they go through the Resend API in Edge Functions — but **password reset** uses Supabase's built-in `/auth/v1/recover`, which needs Auth SMTP.

**Solution**: Configure Resend as the Auth SMTP provider:
1. [Supabase Dashboard](https://supabase.com/dashboard) → project → **Project Settings** → **Authentication** → **SMTP Settings** → enable **Custom SMTP**
2. Host `smtp.resend.com`, Port `465`, Username `resend`, Password = the Resend API key
3. Sender: `team@noreply.pipetooling.com` / "PipeTooling" (domain is verified in Resend)
4. Raise the Auth email rate limit (default is a few per hour) and review **Email OTP expiration** (governs how long invite/magic/recovery links stay valid)

**Verify**: `curl -X POST "$SUPABASE_URL/auth/v1/recover" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"email":"<existing user>"}'` → expect HTTP 200.

---

## Sign-in not working

**Check**:
1. Supabase project is not paused (see above)
2. Correct email and password
3. User exists in Supabase Auth and `users` table
4. [Supabase status](https://status.supabase.com) for outages

---

## RPC returns 404 (e.g. approve_clock_sessions)

**Symptoms**: RPC call returns 404 even though the function exists in the database.

**Solutions**:
1. Reload PostgREST schema: `NOTIFY pgrst, 'reload schema';` in Supabase SQL Editor
2. Ensure client uses `db: { schema: 'public' }` (see [src/lib/supabase.ts](../src/lib/supabase.ts))
3. For approve_clock_sessions, the app uses [approveClockSessions](../src/lib/approveClockSessions.ts) helper with fetch fallback

**See**: TROUBLESHOOT_404.md → RPC 404 and SPA document `/dashboard` 404; [RECENT_FEATURES.md](./RECENT_FEATURES.md) v2.125, v2.191

---

## Investigating errors under load (CLI + logs)

For **timeouts**, **503s**, **DB contention**, or “everyone clocked out and the app died”:

1. **AI agents / Cursor:** start with **[docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md](./runbooks/AGENT_APP_CRASH_INVESTIGATION.md)** (ordered checklist, what CLI cannot see, 28P01 auth). Same file is linked from [AGENTS.md](../AGENTS.md).
2. Follow **[docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md)** — `supabase inspect db … --linked`, Dashboard log export, and a correlation table for `clock_sessions` / `jobs_ledger` triggers.
3. **Quick capture:** from repo root run `./scripts/capture-supabase-incident.sh` — writes **`docs/runbooks/supabase-inspect-snapshot/incident-<UTC>/`** (gitignored); attach that folder when asking an agent to analyze an incident.
4. The CLI does **not** replace hosted **Logs Explorer** exports for API/Auth; capture those for the same UTC window as the incident.

---

## Related docs

- [docs/runbooks/AGENT_APP_CRASH_INVESTIGATION.md](./runbooks/AGENT_APP_CRASH_INVESTIGATION.md) - Agent playbook: *find why the app crashed*
- [docs/runbooks/SUPABASE_INCIDENT_RUNBOOK.md](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md) - Supabase CLI inspect + platform logs workflow
- TROUBLESHOOT_404.md - RPC and Edge function 404 issues
- [RECENT_FEATURES.md](./RECENT_FEATURES.md) - Fix app and pin features (v2.51)
