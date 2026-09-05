# PipeTooling Troubleshooting

---
file: TROUBLESHOOTING.md
type: Troubleshooting guide
purpose: Common issues and how to resolve them
audience: Devs + AI agents
last_updated: 2026-09-05
---

Common issues and how to resolve them.

---

## White screen after app update

**Symptoms**: App shows a blank white screen even after hard reload. Often happens when the app was open during a deploy (e.g. phone left open).

**Cause**: Service worker or browser cache serving stale/corrupted assets. The classic variant: clicking a nav button while running an old build — the route chunk's hashed URL no longer exists after a deploy, the dynamic import 404s, and (before v2.811) the rejection had no error boundary, unmounting the whole tree.

**Auto-recovery (v2.811+)**: a failed route-chunk load now shows "Updating app…" and reloads the app once automatically ([src/lib/chunkLoadRecovery.ts](../src/lib/chunkLoadRecovery.ts): `vite:preloadError` listener in `main.tsx` + `RouteChunkBoundary` around the route outlet in `Layout`). Repeated failures within 60 s stop auto-reloading and show a visible fallback with a **Reload** button and a **Fix app** link instead of a white screen.

**Solution** (if a white screen still appears):
1. Navigate directly to **Fix app**: `https://yoursite.com/fix-cache.html` (replace with your app's base URL)
2. Click **Fix app**
3. The page will unregister service workers, clear caches, clear app localStorage, and reload

**Prevention**: Bookmark `/fix-cache.html` or use the link in Settings → Fix app. Since v2.813 the app also updates itself properly: a "A new version is ready" pill appears when a deploy lands (prompt-mode service worker, [src/components/UpdatePrompt.tsx](../src/components/UpdatePrompt.tsx)) and long-lived tabs check for updates hourly and on tab re-focus — stale builds, the raw material for these white screens, should now be rare.

---

## Supabase database unresponsive / high disk I/O

**Symptoms**: App looks "database down" office-wide; Supabase Dashboard slow or not loading table counts; "High Disk I/O" in metrics; app can't connect.

**Every office-wide freeze so far has been a lock pileup or an instance stall — never a crash and never a capacity problem.** Do NOT reflexively restart, pause/restore, or upgrade compute: a restart destroys the evidence, and in the lock-pileup case it only helps by accident.

**Steps, in order**:

### 1. FIRST: run the freeze triage — /db-freeze
Run the `/db-freeze` skill in Claude Code (or follow [DB_FREEZE_RUNBOOK.md](./DB_FREEZE_RUNBOOK.md) manually). Its 30-second probe distinguishes the two failure modes, which need opposite responses:
- **Mode A — lock pileup**: CLI connects, `supabase inspect db blocking` names a blocker. Fix by terminating just the blocking backend (`SELECT pg_terminate_backend(<pid>);`) — no restart.
- **Mode B — instance stall**: CLI cannot connect at all, no lock waits visible. Restart is the correct and only lever — but only after the runbook's evidence capture, and only when its criteria say you are in Mode B.

### 2. Check for a platform outage
[Supabase status](https://status.supabase.com) — if both the DB-touching and HTTP-only probes hang, suspect networking or a platform incident rather than your database.

### 3. Find and terminate long-running queries (Mode A follow-up)
Via `supabase inspect db long-running-queries --linked`, or in SQL:
```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds'
  AND state != 'idle'
ORDER BY duration DESC;
```
To terminate a query: `SELECT pg_terminate_backend(<pid>);`

### 4. Critical autovacuum (cannot be stopped)
If a wraparound-prevention autovacuum is running, it cannot be terminated. Monitor progress and wait it out:
```sql
SELECT relid::regclass AS table_name,
       round(100.0 * heap_blks_scanned / nullif(heap_blks_total, 0), 2) AS pct_scanned
FROM pg_stat_progress_vacuum;
```

**Not remedies**: upgrading compute (capacity has never been the problem — see DB_FREEZE_RUNBOOK.md), and pause/restore cycles (this is a paid project that never auto-pauses; pausing is pure downtime plus evidence loss).

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
1. Database is responsive (see "Supabase database unresponsive" above)
2. Correct email and password
3. User exists in Supabase Auth and `users` table
4. [Supabase status](https://status.supabase.com) for outages

---

## `[row-cap]` console error — a list silently stopped at 1,000 rows

**Symptoms**: the browser console shows `[row-cap] <table> returned exactly 1000 rows with no limit — PostgREST's max_rows cap silently truncated it.` Users see the same thing as a *missing data* bug: a search that can't find something that exists, a row that renders blank, a total that is too low, a report that only covers part of the company. Nothing errors.

**Cause**: PostgREST answers every read that sets no `limit` with the first `max_rows` (1,000) rows and a 200. Tables cross the cap quietly as the business grows — `material_parts` (Plumbing) did in June 2026 and the Takeoffs part search lost "DI…" through Z until v2.2755. The tripwire in [`src/lib/supabaseRowCapTripwire.ts`](../src/lib/supabaseRowCapTripwire.ts) (wired into the client in `src/lib/supabase.ts`, v2.2756) inspects every response's `Content-Range` and reports the first hit per table per session.

**Fix** (pick one, at the call site the message's `path` points to):
1. **Page it** — `fetchAllRows` / `fetchAllRowsChunkedIn` from [`src/lib/supabasePaging.ts`](../src/lib/supabasePaging.ts) with a stable `.order()`; add a regression test with the fake-cap client (pattern: `src/lib/materials/partsCatalog.test.ts`).
2. **Bound it** — `.limit(n)`, `.in('id', ids)`, or a narrower filter, when the surface only ever needs a slice.
3. **Prove it isn't capped** — `select('…', { count: 'exact' })`: a known total ≤ 1,000 silences the tripwire, because exactly 1,000 real rows is then a fact, not a symptom.

Never raise `max_rows` instead — it moves the cliff and hides it again.

## "No connection — check your signal" vs "You don't have access" / "This link points to something that doesn't exist"

**What the messages mean (since v2.2843)**: every database failure is classified by *class*, never by message text (`src/utils/errorHandling.ts` → `DatabaseError.kind`):

| The user sees | `kind` | What happened | Retried? |
| --- | --- | --- | --- |
| "No connection — the app couldn't reach the server, so nothing was saved. Check your signal and try again." | `network` | The browser's `fetch` itself rejected (`TypeError: Failed to fetch` / `Load failed`); supabase-js reports it as `code: ''`, `status: 0`. The request never reached PostgREST. | yes (4 attempts, jittered backoff) |
| "You don't have access to this <thing>." / "You don't have permission to <operation>." | `server` `42501` | RLS or a grant refused the read/write. Check the role's policies (`docs/ACCESS_CONTROL.md`), not the wifi. | no |
| "This link points to something that doesn't exist any more." | `server` `22P02` / `PGRST116` | A malformed id reached a uuid column (the week grid's `?jobId=bid:<uuid>`, J18-F1) or `.single()` found no row (deleted record, stale link). | no |
| "Couldn't load <thing>: <server message>" / "Failed to <operation>: <server message>" | `server` other | PostgREST answered with some other code — missing column, constraint, RPC error. The server message is the lead. | only transient codes (`40001`, `40P01`, `53xxx`, `08xxx`, `PGRST000-003`) or 408/429/5xx with no code |

**If a user reports "No connection" on good wifi**: open the console — every shown error logs one `[error-class] <kind> <code> <operation>` line per (kind, code, operation) per page load (`src/lib/errorClassTelemetry.ts`). `network - <op>` with a working connection means something upstream of PostgREST (Cloudflare, DNS, a service-worker fetch) rejected; `server <code> <op>` rendering the offline copy should be impossible — file it against `errorHandling.ts`.

**Before v2.2843** the offline copy was fabricated for ~100 `fetch…`-named operations: the `Failed to fetch<Op>:` prefix contained the literal `failed to fetch` token, and `isRetryableError` retried on the bare word `fetch`. Any refused or malformed read looked like an outage and was retried four times. If you see that pattern on an old build, it is the message that is wrong, not the connection.

**Adding a new code family**: extend `ACCESS_DENIED_CODES` / `BROKEN_LINK_CODES` / `TRANSIENT_SERVER_CODES` in `errorHandling.ts` and add the case to `src/utils/errorHandling.test.ts`. Never add a message-text token for a server error.

## RPC returns 404 (e.g. approve_clock_sessions)

**Symptoms**: RPC call returns 404 even though the function exists in the database.

**Solutions**:
1. Reload PostgREST schema: `NOTIFY pgrst, 'reload schema';` in Supabase SQL Editor
2. Ensure client uses `db: { schema: 'public' }` (see [src/lib/supabase.ts](../src/lib/supabase.ts))
3. For approve_clock_sessions, the app uses [approveClockSessions](../src/lib/approveClockSessions.ts) helper with fetch fallback

**Note**: a separate, harmless kind of 404 is the SPA **document** 404 on deep links (e.g. `GET /dashboard`) — GitHub Pages serves `404.html` (a copy of `index.html`) and the app still loads. In-app **Hard Reload** avoids the noisy document 404 by loading `/` first and restoring the route via `history.replaceState`; see [src/lib/hardReload.ts](../src/lib/hardReload.ts) and the inline script in [index.html](../index.html).

**See**: [RECENT_FEATURES.md](./RECENT_FEATURES.md) v2.125, v2.191

---

## "infinite recursion detected in policy for relation X"

**Symptoms**: A read or write on a table fails with `infinite recursion detected in policy for relation "<table>"`. Seen 2026-07-04 on **every** `public.users` UPDATE (role changes, profile edits) — the failing policy queried `users` inside a `users` policy.

**Cause**: An RLS policy on a table references **that same table** in its `USING` / `WITH CHECK` expression (e.g. `EXISTS (SELECT 1 FROM users WHERE …)` inside a policy **on** `users`). Postgres re-applies the policy while evaluating the subquery → unbounded recursion.

**Solution**: Move the self-referential check into a **`SECURITY DEFINER`** helper function (which bypasses RLS), then reference the helper from the policy. The repo already does this for the common role checks — `is_dev()`, `is_master_or_dev()`, `is_estimator()`, `is_user_notes_editor()`, etc. Pattern and rationale are in [ADDING_A_NEW_ROLE.md](./ADDING_A_NEW_ROLE.md) ("Helper Functions"). Never put a bare `FROM <same-table>` subquery in a policy on that table.

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
- [src/lib/hardReload.ts](../src/lib/hardReload.ts) + [index.html](../index.html) - SPA reload / document-404 mechanism (Hard Reload loads `/` then restores the route)
- [RECENT_FEATURES.md](./RECENT_FEATURES.md) - Fix app and pin features (v2.51)
