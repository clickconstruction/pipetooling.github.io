# Troubleshooting 404 Errors

## `GET /dashboard` (or any app route) shows **404** in the browser Network tab

**Context**: PipeTooling is a SPA on **GitHub Pages**. There is no real file at `/dashboard`—only `index.html` and a **`404.html`** copy of it ([`vite.config.ts`](vite.config.ts) `copy404Plugin`). GitHub Pages often returns **HTTP 404** for unknown paths while still **serving** `404.html`, so React Router can run. The DevTools **404** line may be **normal** if the app loads.

**If the page is blank or stuck**:

1. Confirm **[`dist/404.html`](vite.config.ts)** is deployed (CI checks this in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
2. After a full load once, the **service worker** ([`src/sw.ts`](src/sw.ts)) uses a **navigation fallback** to `index.html` so refreshes on `/dashboard` are handled from cache when the SW is active.
3. **Hard refresh** or **unregister the service worker** (Application → Service Workers) if an old SW cached a bad response; try a private window.
4. **Custom domain + Cloudflare (or other CDN)**: Ensure the CDN is not caching or replacing GitHub’s `404.html` behavior. You may need a **rewrite rule** (e.g. serve `index.html` for unknown paths with **200**) if the host strips SPA fallbacks.

---

## RPC 404 (e.g. approve_clock_sessions)

**Symptoms**: `POST /rest/v1/rpc/approve_clock_sessions` returns 404 even though the function exists and works via SQL.

**Solutions**:

1. **Reload PostgREST schema cache**: In Supabase SQL Editor, run:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

2. **Explicit schema in client**: The Supabase client uses `db: { schema: 'public' }` in [src/lib/supabase.ts](src/lib/supabase.ts). If missing, add it to avoid schema mismatches.

3. **approveClockSessions helper**: [src/lib/approveClockSessions.ts](src/lib/approveClockSessions.ts) uses `supabase.schema('public').rpc(...)` and has a fetch fallback when RPC returns 404. People Hours and Quickfill Hours use this helper.

4. **Verify function in OpenAPI**: `GET https://your-project.supabase.co/rest/v1/` with `Accept: application/openapi+json` — search for the RPC path. If missing, schema cache may be stale.

**See**: [RECENT_FEATURES.md](RECENT_FEATURES.md) v2.125; [MIGRATIONS.md](MIGRATIONS.md) → 20260427120000

---

## Edge Function 404 (e.g. send-workflow-notification)

### The Problem
Getting 404 error for an Edge Function even though:
- ✅ Function is deployed and active in Supabase Dashboard
- ✅ JWT is disabled
- ✅ API key is active
- ✅ Edge function shows as active

### Possible Causes & Solutions

#### 1. Function Name Mismatch
**Check**: The function name in Supabase Dashboard must match EXACTLY (case-sensitive, hyphens matter)

**Solution**:
- Go to Supabase Dashboard → Edge Functions
- Check the EXACT name of your function
- It should be: `send-workflow-notification` (with hyphens, lowercase)
- If it's different (e.g., `send_workflow_notification` or `Send-Workflow-Notification`), either:
  - Rename it in the dashboard to match, OR
  - Update the code to match the dashboard name

#### 2. Project URL Mismatch
**Check**: Your `.env` file might be pointing to a different project

**Solution**:
1. Check your `.env` file:
   ```
   VITE_SUPABASE_URL=https://yewfzhbofbbyvkvtaatw.supabase.co
   ```
2. Verify this matches the project where the function is deployed
3. In Supabase Dashboard, check your project URL (Settings → API)
4. Make sure they match exactly

#### 3. Deployment Propagation Delay
**Check**: Sometimes deployments take a few minutes to propagate

**Solution**:
- Wait 2-5 minutes after deployment
- Hard refresh your browser (Ctrl+Shift+R / Cmd+Shift+R)
- Clear browser cache
- Try in an incognito/private window

#### 4. Function Not Fully Deployed
**Check**: The function might show as "active" but not be fully deployed

**Solution**:
1. Go to Supabase Dashboard → Edge Functions
2. Click on `send-workflow-notification`
3. Check the "Logs" tab - if there are deployment errors, you'll see them
4. Try redeploying the function:
   - Click "Edit"
   - Click "Deploy" again
   - Wait for deployment to complete

#### 5. Region Mismatch
**Check**: If your Supabase project is in a specific region, the function might need to be in the same region

**Solution**:
- Check your Supabase project region (Settings → General)
- Make sure the Edge Function is deployed to the same region

#### 6. Browser Cache / Service Worker
**Check**: Old cached code might be using a different function name

**Solution**:
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Clear browser cache
- Try in incognito/private window
- If using a service worker, unregister it

#### 7. Check Function URL Directly
**Test**: Try accessing the function URL directly

**Solution**:
1. Get your Supabase URL from `.env`: `VITE_SUPABASE_URL`
2. Construct the function URL: `https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/send-workflow-notification`
3. Try a POST request to this URL (using Postman, curl, or browser DevTools)
4. You should get a response (even if it's an error about missing auth)

#### 8. Verify Function Code
**Check**: Make sure the function code in the dashboard matches the file

**Solution**:
1. Open `supabase/functions/send-workflow-notification/index.ts` in your project
2. Copy ALL the code
3. Go to Supabase Dashboard → Edge Functions → `send-workflow-notification` → Edit
4. Compare the code - make sure it matches exactly
5. If different, paste the correct code and redeploy

#### 9. Check Supabase Client Configuration
**Check**: The Supabase client might be configured incorrectly

**Solution**:
1. Open browser DevTools → Console
2. Check the new logging I added - it will show:
   - The function name being called
   - The Supabase URL
   - The expected function URL
3. Verify these match what you see in Supabase Dashboard

#### 10. Test with a Simple Function Call
**Test**: Try invoking the function with minimal data

**Solution**:
Open browser console and run:
```javascript
// Get your supabase client
const supabase = window.supabase || // however you access it

// Test the function
supabase.functions.invoke('send-workflow-notification', {
  body: {
    template_type: 'stage_assigned_started',
    step_id: 'test-id',
    recipient_email: 'test@example.com',
    recipient_name: 'Test User',
    variables: {}
  }
}).then(result => {
  console.log('Result:', result)
}).catch(error => {
  console.error('Error:', error)
})
```

## Quick Diagnostic Steps

1. **Check function name in dashboard** - Must be exactly `send-workflow-notification`
2. **Check project URL** - Must match `.env` file
3. **Check function is deployed** - Should show "Active" status
4. **Check logs** - Look for any deployment errors
5. **Hard refresh browser** - Clear cache
6. **Check console logs** - The new logging will show the exact URL being called

## Most Common Issue

The most common cause is a **function name mismatch**. Double-check:
- Dashboard shows: `send-workflow-notification`
- Code calls: `'send-workflow-notification'`
- They must match EXACTLY (case-sensitive, hyphens vs underscores)

## Still Not Working?

If none of these work:
1. Check the browser console for the new detailed logs I added
2. Share the console output showing the expected URL
3. Verify the function name in Supabase Dashboard matches exactly
4. Try creating a new function with a different name to test if the issue is specific to this function
