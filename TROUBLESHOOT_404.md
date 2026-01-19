# Troubleshooting 404 Error for send-workflow-notification

## The Problem
Getting 404 error even though:
- ✅ Function is deployed and active in Supabase Dashboard
- ✅ JWT is disabled
- ✅ API key is active
- ✅ Edge function shows as active

## Possible Causes & Solutions

### 1. Function Name Mismatch
**Check**: The function name in Supabase Dashboard must match EXACTLY (case-sensitive, hyphens matter)

**Solution**:
- Go to Supabase Dashboard → Edge Functions
- Check the EXACT name of your function
- It should be: `send-workflow-notification` (with hyphens, lowercase)
- If it's different (e.g., `send_workflow_notification` or `Send-Workflow-Notification`), either:
  - Rename it in the dashboard to match, OR
  - Update the code to match the dashboard name

### 2. Project URL Mismatch
**Check**: Your `.env` file might be pointing to a different project

**Solution**:
1. Check your `.env` file:
   ```
   VITE_SUPABASE_URL=https://yewfzhbofbbyvkvtaatw.supabase.co
   ```
2. Verify this matches the project where the function is deployed
3. In Supabase Dashboard, check your project URL (Settings → API)
4. Make sure they match exactly

### 3. Deployment Propagation Delay
**Check**: Sometimes deployments take a few minutes to propagate

**Solution**:
- Wait 2-5 minutes after deployment
- Hard refresh your browser (Ctrl+Shift+R / Cmd+Shift+R)
- Clear browser cache
- Try in an incognito/private window

### 4. Function Not Fully Deployed
**Check**: The function might show as "active" but not be fully deployed

**Solution**:
1. Go to Supabase Dashboard → Edge Functions
2. Click on `send-workflow-notification`
3. Check the "Logs" tab - if there are deployment errors, you'll see them
4. Try redeploying the function:
   - Click "Edit"
   - Click "Deploy" again
   - Wait for deployment to complete

### 5. Region Mismatch
**Check**: If your Supabase project is in a specific region, the function might need to be in the same region

**Solution**:
- Check your Supabase project region (Settings → General)
- Make sure the Edge Function is deployed to the same region

### 6. Browser Cache / Service Worker
**Check**: Old cached code might be using a different function name

**Solution**:
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Clear browser cache
- Try in incognito/private window
- If using a service worker, unregister it

### 7. Check Function URL Directly
**Test**: Try accessing the function URL directly

**Solution**:
1. Get your Supabase URL from `.env`: `VITE_SUPABASE_URL`
2. Construct the function URL: `https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/send-workflow-notification`
3. Try a POST request to this URL (using Postman, curl, or browser DevTools)
4. You should get a response (even if it's an error about missing auth)

### 8. Verify Function Code
**Check**: Make sure the function code in the dashboard matches the file

**Solution**:
1. Open `supabase/functions/send-workflow-notification/index.ts` in your project
2. Copy ALL the code
3. Go to Supabase Dashboard → Edge Functions → `send-workflow-notification` → Edit
4. Compare the code - make sure it matches exactly
5. If different, paste the correct code and redeploy

### 9. Check Supabase Client Configuration
**Check**: The Supabase client might be configured incorrectly

**Solution**:
1. Open browser DevTools → Console
2. Check the new logging I added - it will show:
   - The function name being called
   - The Supabase URL
   - The expected function URL
3. Verify these match what you see in Supabase Dashboard

### 10. Test with a Simple Function Call
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
