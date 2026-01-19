# Quick Deploy: send-workflow-notification

## The Problem
You're getting a 404 error because the Edge Function hasn't been deployed yet.

## Quick Fix: Deploy via Supabase Dashboard

### Step 1: Go to Supabase Dashboard
1. Open https://supabase.com/dashboard
2. Select your project (the one with URL `yewfzhbofbbyvkvtaatw.supabase.co`)

### Step 2: Navigate to Edge Functions
1. Click **"Edge Functions"** in the left sidebar
2. Click **"Create a new function"** button (or find `send-workflow-notification` if it already exists)

### Step 3: Set Function Name
- **Function Name**: `send-workflow-notification`
  - Must match exactly (with hyphens, not underscores)

### Step 4: Copy the Code
1. Open this file in your project:
   ```
   supabase/functions/send-workflow-notification/index.ts
   ```
2. **Copy ALL the code** (Ctrl+A, Ctrl+C / Cmd+A, Cmd+C)
3. **Paste it** into the function editor in Supabase Dashboard

### Step 5: Configure Settings
**IMPORTANT**: 
- **Verify JWT**: Set to **DISABLED** (unchecked)
  - The function does manual JWT validation, so gateway verification must be OFF

### Step 6: Deploy
1. Click **"Deploy"** button
2. Wait 10-30 seconds for deployment

### Step 7: Set the Secret (if not already set)
The function needs `RESEND_API_KEY` secret:

1. In Supabase Dashboard, go to **Edge Functions** → **Secrets**
2. If `RESEND_API_KEY` doesn't exist, add it:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (starts with `re_`)
   - Click **"Add Secret"**

**Note**: If you already deployed `test-email` function, this secret should already exist.

### Step 8: Verify Deployment
1. Go back to **Edge Functions** list
2. You should see `send-workflow-notification` with status **"Active"**
3. Verify JWT should show **"Disabled"**

### Step 9: Test
1. Go back to your app
2. Try starting/completing a workflow step
3. Check browser console - the 404 error should be gone
4. Check Edge Function logs in Supabase Dashboard to see if emails are being sent

## Troubleshooting

### Still getting 404?
- **Check function name**: Must be exactly `send-workflow-notification` (with hyphens)
- **Check it's deployed**: Should show "Active" status
- **Refresh your app**: Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Getting "RESEND_API_KEY not configured"?
- Go to Edge Functions → Secrets
- Make sure `RESEND_API_KEY` is set
- If it's missing, add it with your Resend API key

### Getting "Email template not found"?
- You need to create email templates first
- Go to Settings → Email Templates in your app
- Create templates for the notification types you're testing

### Function deployed but still not working?
- Check Edge Functions → `send-workflow-notification` → **Logs** tab
- Look for error messages
- Common issues:
  - Missing email templates
  - Invalid email addresses
  - Resend API key issues

## Next Steps
After deployment:
1. ✅ Function should be active
2. ✅ 404 error should be resolved
3. 📝 Create email templates in Settings if needed
4. 🧪 Test notifications by changing workflow step statuses
