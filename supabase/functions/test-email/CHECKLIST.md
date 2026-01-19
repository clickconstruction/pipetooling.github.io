# Edge Function Setup Checklist

## ✅ What to Verify

### 1. Resend API Key Secret
- [ ] Go to Supabase Dashboard → Settings → Edge Functions → Secrets
- [ ] Verify `RESEND_API_KEY` exists
- [ ] Value should be: `re_M4Wgwi9Z_3Hed4JBNU6ATerUhWEC8AYtT`

### 2. Domain Verification in Resend
- [ ] Go to Resend Dashboard → Domains
- [ ] Verify `pipetooling.com` is added and verified
- [ ] Check DNS records are properly configured
- [ ] Status should show "Verified" (green checkmark)

### 3. Edge Function Deployment
- [ ] Go to Supabase Dashboard → Edge Functions
- [ ] Find `test-email` function
- [ ] Status should be "Active" or "Deployed"
- [ ] Verify the code includes:
  - ✅ Resend API integration (lines 79-107)
  - ✅ Sender email: `noreply@pipetooling.com` (line 101)
  - ✅ Proper error handling
  - ✅ Owner-only access check

### 4. Function Code Check
The function should have:
- [ ] Line 101: `from: 'Pipetooling <noreply@pipetooling.com>'`
- [ ] Line 80: `const resendApiKey = Deno.env.get('RESEND_API_KEY')`
- [ ] Line 94: `fetch('https://api.resend.com/emails', ...)`
- [ ] Proper CORS headers
- [ ] Owner role check (line 53)

### 5. Test the Function
- [ ] Go to http://localhost:5173/settings
- [ ] Scroll to Email Templates section
- [ ] Click "Test" on any template
- [ ] Enter your email address
- [ ] Click "Send Test Email"
- [ ] Check your inbox (and spam folder)
- [ ] Email should come from `noreply@pipetooling.com`

## Common Issues

### Issue: "RESEND_API_KEY not configured"
**Solution**: Set the secret in Supabase Dashboard → Settings → Edge Functions → Secrets

### Issue: "Failed to send email via Resend"
**Possible causes**:
1. Domain not verified in Resend
2. API key incorrect
3. Domain DNS records not configured
4. Resend quota exceeded

**Check**:
- Resend Dashboard → Domains → Verify domain status
- Resend Dashboard → API Keys → Verify key is active
- Resend Dashboard → Emails → Check for error logs

### Issue: Email not received
**Check**:
- Spam/junk folder
- Resend Dashboard → Emails → Check delivery status
- Verify email address is correct
- Check Resend logs for bounce/spam reports

### Issue: Wrong sender email
**Solution**: Update line 101 in the function to use your verified domain:
```typescript
from: 'Pipetooling <noreply@pipetooling.com>'
```

## Next Steps After Verification

Once everything works:
1. ✅ Test all email template types
2. ✅ Update other Edge Functions (`invite-user`, `login-as-user`) to use Resend
3. ✅ Implement workflow stage notification emails
4. ✅ Customize email templates further
