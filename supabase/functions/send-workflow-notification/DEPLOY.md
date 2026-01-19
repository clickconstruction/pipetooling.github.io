# Deploy Send Workflow Notification Function

This Edge Function sends workflow stage notifications via email using Resend.

## Prerequisites

1. **Resend API Key** - You should already have this set up for the `test-email` function
2. **Supabase CLI** (optional, but recommended) - Or use the Dashboard method

## Step 1: Verify Resend API Key is Set

The function uses the same `RESEND_API_KEY` secret as the `test-email` function. Verify it's set:

```bash
supabase secrets list
```

If it's not there, set it:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
```

**Important**: Make sure you're in the correct Supabase project. Verify with:
```bash
supabase projects list
```

## Step 2: Deploy the Function

### Option A: Via Supabase CLI (Recommended)

From the project root directory:

```bash
cd /Users/robertdouglas/_SYNC/github/Click-Construction/pipetooling/pipetooling.github.io
supabase functions deploy send-workflow-notification --no-verify-jwt
```

The `--no-verify-jwt` flag is important - the function does manual JWT validation, so gateway-level verification should be disabled.

### Option B: Via Supabase Dashboard

1. **Go to Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Click **"Create a new function"** (or find `send-workflow-notification` if it exists)

3. **Set Function Name**
   - Name: `send-workflow-notification`

4. **Copy the Code**
   - Open `supabase/functions/send-workflow-notification/index.ts` from your project
   - Copy ALL the code
   - Paste it into the function editor in Supabase Dashboard

5. **Configure Function Settings**
   - **Verify JWT**: Set to **DISABLED** (unchecked)
     - The function does manual JWT validation, so gateway verification must be off
   - **Import Map**: Leave default (if applicable)

6. **Deploy**
   - Click **"Deploy"** button
   - Wait for deployment to complete (usually 10-30 seconds)

## Step 3: Verify Deployment

After deployment, you should see:
- Function listed in Edge Functions
- Status: Active/Deployed
- Verify JWT: Disabled

## Step 4: Test the Function

The function will be automatically called when workflow steps change status. To test:

1. **Go to a workflow page** in your app
2. **Start a workflow step** (if notifications are enabled for the assigned person)
3. **Check the browser console** for any errors (notifications are sent asynchronously)
4. **Check Supabase Logs**:
   - Go to Edge Functions → `send-workflow-notification` → **Logs** tab
   - Look for successful sends or errors

5. **Check your email** (if you're the recipient)

## Troubleshooting

### "RESEND_API_KEY not configured"
- Make sure you set the secret: `supabase secrets set RESEND_API_KEY=...`
- Verify you're in the correct project
- The secret should already exist if you deployed `test-email` successfully

### "Unauthorized - Invalid token"
- The function validates JWT tokens manually
- Make sure you're logged in to the app
- Check that the Authorization header is being sent correctly

### "Email template not found"
- Make sure you've created email templates in Settings → Email Templates
- The template type must match exactly (e.g., `stage_assigned_started`)
- See `EMAIL_TEMPLATES_SETUP.md` for the list of template types

### Notifications not being sent
- Check notification preferences are enabled in the workflow step
- Verify the recipient has an email address in `people` or `users` table
- Check Supabase function logs for errors
- Notifications are sent asynchronously (fire-and-forget), so errors won't block the UI

### Function not being called
- Check browser console for errors when workflow steps change
- Verify the function name matches: `send-workflow-notification`
- Make sure the function is deployed and active

## Function Details

**Function Name**: `send-workflow-notification`

**Authentication**: 
- Requires valid JWT token
- Any authenticated user can trigger notifications (the function validates internally)

**Input**:
```typescript
{
  template_type: string,      // e.g., 'stage_assigned_started'
  step_id: string,            // UUID of the workflow step
  recipient_email: string,    // Email address to send to
  recipient_name: string,    // Name of recipient
  variables?: Record<string, string>  // Template variables to replace
}
```

**Template Variables Supported**:
- `{{name}}` - Recipient's name
- `{{email}}` - Recipient's email
- `{{project_name}}` - Project name
- `{{stage_name}}` - Workflow stage name
- `{{assigned_to_name}}` - Person assigned to stage
- `{{workflow_link}}` - Link to view workflow
- `{{previous_stage_name}}` - Previous stage name (for cross-step)
- `{{rejection_reason}}` - Rejection reason (for rejections)

## Related Functions

- `test-email` - Sends test emails for template testing
- Both functions use the same `RESEND_API_KEY` secret

## Next Steps

After deployment:
1. ✅ Function is deployed and active
2. ✅ Notifications will automatically send when workflow steps change
3. 📝 Create email templates in Settings if you haven't already
4. 🧪 Test by changing workflow step statuses
