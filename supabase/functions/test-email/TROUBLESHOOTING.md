# Troubleshooting "Edge Function returned a non-2xx status code"

## Common Causes & Solutions

### 1. RESEND_API_KEY Not Set
**Error**: "RESEND_API_KEY not configured"

**Solution**:
1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
2. Add secret: `RESEND_API_KEY` = `re_M4Wgwi9Z_3Hed4JBNU6ATerUhWEC8AYtT`
3. Redeploy the function

### 2. Domain Not Verified in Resend
**Error**: "Failed to send email via Resend (403)" or "domain is not verified"

**Solution**:
1. Go to Resend Dashboard → Domains
2. Verify `noreply.pipetooling.com` is added
3. Check domain status - should show "Verified" (green checkmark)
4. If not verified, add the DNS records Resend provides
5. Wait for DNS propagation (can take a few minutes to hours)

### 3. Invalid Email Address Format
**Error**: "Invalid email address" or "Failed to send email via Resend (422)"

**Solution**:
- Check the email address you're testing with
- Make sure it's a valid format: `user@example.com`

### 4. Resend API Quota Exceeded
**Error**: "Failed to send email via Resend (429)"

**Solution**:
- Check Resend Dashboard → Usage
- Free tier: 3,000 emails/month
- Upgrade plan if needed

### 5. Function Not Deployed
**Error**: "Function not found" or connection errors

**Solution**:
1. Go to Supabase Dashboard → Edge Functions
2. Verify `test-email` function exists and is deployed
3. Check function status is "Active"
4. Redeploy if needed

### 6. Authentication Issues
**Error**: "Unauthorized" or "Forbidden"

**Solution**:
- Make sure you're logged in as an owner
- Check your user role in Settings
- Verify JWT token is being sent correctly

## How to Debug

### Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages when clicking "Send Test Email"
4. Check Network tab for the function call details

### Check Supabase Logs
1. Go to Supabase Dashboard → Edge Functions → `test-email`
2. Click "Logs" tab
3. Look for error messages
4. Check the most recent function invocations

### Check Resend Dashboard
1. Go to Resend Dashboard → Emails
2. Check if emails are being attempted
3. Look for error messages or bounce reports
4. Check API usage and limits

## Quick Test Checklist

- [ ] RESEND_API_KEY secret is set in Supabase
- [ ] Domain `noreply.pipetooling.com` is verified in Resend
- [ ] Function `test-email` is deployed and active
- [ ] You're logged in as an owner
- [ ] Email address format is valid
- [ ] Resend API quota not exceeded

## Most Common Issue

**Domain not verified** is the most common cause. Make sure:
1. `noreply.pipetooling.com` is added in Resend Dashboard → Domains
2. DNS records are configured correctly
3. Domain shows as "Verified" (not "Pending" or "Failed")

If domain verification is pending, you can temporarily use `onboarding@resend.dev` to test, but update to your domain once verified.
