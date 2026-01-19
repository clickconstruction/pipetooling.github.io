# Deploy the test-email Function NOW

You're getting a 401 error because the Edge Function needs to be redeployed with the updated JWT validation code.

## Quick Steps (Supabase Dashboard)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Find `test-email` in the list

3. **Edit the Function**
   - Click on `test-email`
   - Click **Edit** button (or the code editor icon)

4. **Replace the Code**
   - Select ALL the code in the editor (Ctrl+A / Cmd+A)
   - Delete it
   - Open the file: `supabase/functions/test-email/index.ts` from your project
   - Copy ALL the code from that file
   - Paste it into the Supabase editor

5. **Deploy**
   - Click **Deploy** button (or Save/Deploy)
   - Wait for deployment to complete (usually 10-30 seconds)

6. **Verify Configuration**
   - After deployment, check the function settings
   - Look for "Verify JWT" or similar setting
   - It should be **DISABLED** (set to `false` or unchecked)
   - If it's enabled, disable it (the function does manual JWT validation)

7. **Test**
   - Go back to your app
   - Try sending a test email again
   - Should work now!

## If You Still Get 401

1. **Check Supabase Logs**
   - Go to Edge Functions → `test-email` → **Logs** tab
   - Look for error messages
   - The logs will show if the JWT is being received

2. **Verify You're Logged In**
   - Make sure you're signed in to your app
   - Try signing out and back in

3. **Check Your Role**
   - You must be a `dev` role to send test emails
   - Go to Settings → Admin Code to verify your role

4. **Check Function Configuration**
   - The function MUST have JWT verification disabled at the gateway level
   - It does manual validation instead
   - If gateway verification is enabled, it will reject requests before our code runs

## Alternative: Deploy via CLI

If you have Supabase CLI installed:

```bash
cd supabase/functions/test-email
supabase functions deploy test-email --no-verify-jwt
```

The `--no-verify-jwt` flag ensures the gateway doesn't validate JWTs (we do it manually in the code).
