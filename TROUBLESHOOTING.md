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

## Duplicate key error when pinning

**Error**: `duplicate key value violates unique constraint "user_pinned_tabs_user_path_tab_key"`

**Cause**: Trying to add a pin that already exists for that user/path/tab.

**Resolution**: The app now treats this as success (no error shown). If you still see it, ensure you're on the latest build. The `addPinForUser` function handles duplicate inserts gracefully.

---

## Sign-in not working

**Check**:
1. Supabase project is not paused (see above)
2. Correct email and password
3. User exists in Supabase Auth and `users` table
4. [Supabase status](https://status.supabase.com) for outages

---

## Related docs

- [TROUBLESHOOT_404.md](./TROUBLESHOOT_404.md) - Edge function 404 issues
- [RECENT_FEATURES.md](./RECENT_FEATURES.md) - Fix app and pin features (v2.51)
