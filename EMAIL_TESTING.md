# Email Templates - Testing & Implementation Status

## Current Status

### ✅ What's Working
1. **UI for managing templates** - Owners can create/edit email templates in Settings
2. **Database storage** - Templates are stored in `email_templates` table
3. **Test email button** - Added to each template (requires Edge Function)

### ⚠️ What's NOT Working Yet
1. **Templates are NOT being used** - Edge Functions still use default/hardcoded emails
2. **Test email function** - Needs to be created as an Edge Function
3. **Workflow stage notifications** - Not implemented yet (only subscription tracking exists)

## How to Test Emails

### Option 1: Test via Test Button (Requires Edge Function)

1. **Create the `test-email` Edge Function** in Supabase:
   ```typescript
   // supabase/functions/test-email/index.ts
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   serve(async (req) => {
     if (req.method === 'OPTIONS') {
       return new Response(null, {
         headers: {
           'Access-Control-Allow-Origin': '*',
           'Access-Control-Allow-Methods': 'POST, OPTIONS',
           'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
         },
       })
     }

     try {
       const { to, subject, body, template_type } = await req.json()
       
       // Use Supabase's email service or your email provider
       // For now, this is a placeholder - you'll need to integrate with your email service
       
       return new Response(
         JSON.stringify({ success: true, message: 'Test email would be sent' }),
         {
           headers: {
             'Content-Type': 'application/json',
             'Access-Control-Allow-Origin': '*',
           },
         }
       )
     } catch (error) {
       return new Response(
         JSON.stringify({ error: error.message }),
         {
           status: 400,
           headers: {
             'Content-Type': 'application/json',
             'Access-Control-Allow-Origin': '*',
           },
         }
       )
     }
   })
   ```

2. **Click "Test" button** on any template in Settings
3. **Enter your email address**
4. **Check your inbox** for the test email

### Option 2: Test Actual User Emails

Currently, these emails use Supabase's default templates or Edge Functions that don't use custom templates yet:

1. **Invitation Email** - Uses `invite-user` Edge Function (needs update)
2. **Sign-In Email** - Uses Supabase's built-in `signInWithOtp` (uses Supabase default template)
3. **Login As Email** - Uses `login-as-user` Edge Function (needs update)

To test:
- Go to Settings → Users → "Invite via email" or "Send email to sign in"
- These will send emails but won't use your custom templates yet

## What Needs to Be Done

### 1. Update Edge Functions to Use Templates

#### `invite-user` Edge Function
- Fetch template from `email_templates` where `template_type = 'invitation'`
- Replace variables: `{{name}}`, `{{email}}`, `{{role}}`, `{{link}}`
- Send email with custom subject/body

#### `login-as-user` Edge Function  
- Fetch template from `email_templates` where `template_type = 'login_as'`
- Replace variables: `{{name}}`, `{{email}}`, `{{link}}`
- Send email with custom subject/body

#### `sendSignInEmail` Function (in Settings.tsx)
- Fetch template from `email_templates` where `template_type = 'sign_in'`
- Replace variables: `{{name}}`, `{{email}}`, `{{link}}`
- Note: This uses Supabase's `signInWithOtp` which has limited customization
- May need to use a custom email service instead

### 2. Implement Workflow Stage Notifications

Currently, workflow stage notifications are **only tracked** but **not sent**. You need to:

1. **Create a notification service** (Edge Function or background job)
2. **Trigger on workflow step changes**:
   - When step status changes to `in_progress` → send `stage_assigned_started` or `stage_me_started`
   - When step status changes to `completed` → send `stage_assigned_complete` or `stage_me_complete`
   - When step status changes to `pending` (reopened) → send `stage_assigned_reopened` or `stage_me_reopened`
   - When step is `completed` or `approved` → send `stage_next_complete_or_approved` to next assignee
   - When step is `rejected` → send `stage_prior_rejected` to prior assignee

3. **Check notification preferences**:
   - For assigned person: Check `notify_assigned_when_*` flags on the step
   - For ME: Check `step_subscriptions` table
   - For cross-step: Check `notify_next_assignee_*` and `notify_prior_assignee_*` flags

4. **Fetch appropriate template** and replace variables
5. **Send email** via your email service

### 3. Email Service Integration

You'll need to integrate with an email service. Options:

- **Supabase Email** (if available in your plan)
- **SendGrid**
- **Mailgun**
- **AWS SES**
- **Resend**
- **Postmark**

## Quick Test Without Edge Function

You can preview what the email will look like by:

1. Edit a template in Settings
2. The variables will show as `{{variable_name}}`
3. Manually replace them to see the final result

Or use the browser console:
```javascript
// In browser console on Settings page
const template = { subject: "Hi {{name}}", body: "Welcome {{name}}!" }
const vars = { name: "Test User" }
const result = {
  subject: template.subject.replace(/\{\{name\}\}/g, vars.name),
  body: template.body.replace(/\{\{name\}\}/g, vars.name)
}
console.log(result)
```

## Next Steps

1. ✅ Create `email_templates` table (see EMAIL_TEMPLATES_SETUP.md)
2. ⏳ Create `test-email` Edge Function
3. ⏳ Update `invite-user` Edge Function to use templates
4. ⏳ Update `login-as-user` Edge Function to use templates
5. ⏳ Implement workflow stage notification sending
6. ⏳ Set up email service integration
