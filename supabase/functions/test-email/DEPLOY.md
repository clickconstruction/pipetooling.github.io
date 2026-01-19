# Deploy Test Email Function with Resend

## Step 1: Set Resend API Key as Secret

Run this command in your terminal (replace with your actual API key):

```bash
supabase secrets set RESEND_API_KEY=re_M4Wgwi9Z_3Hed4JBNU6ATerUhWEC8AYtT
```

**Important**: Make sure you're in the correct Supabase project. You can verify with:
```bash
supabase projects list
```

## Step 2: Deploy the Function

### Option A: Via Supabase CLI

```bash
cd /Users/robertdouglas/_SYNC/github/Click-Construction/pipetooling/pipetooling.github.io
supabase functions deploy test-email
```

### Option B: Via Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** in the left sidebar
4. Click **"Create a new function"** or find `test-email` if it exists
5. Copy the entire contents of `supabase/functions/test-email/index.ts`
6. Paste into the function editor
7. Click **"Deploy"**

## Step 3: Verify Deployment

After deployment, you should see:
- Function listed in Edge Functions
- Status: Active/Deployed

## Step 4: Test the Function

1. Go to your app: http://localhost:5173/settings
2. Scroll to **Email Templates** section
3. Click **"Test"** on any template
4. Enter your email address
5. Click **"Send Test Email"**
6. Check your inbox!

## Troubleshooting

### "RESEND_API_KEY not configured"
- Make sure you set the secret: `supabase secrets set RESEND_API_KEY=...`
- Verify you're in the correct project

### "Failed to send email via Resend"
- Check Resend dashboard for API usage/quota
- Verify API key is correct
- Check Resend logs for delivery issues

### Email not received
- Check spam folder
- Verify email address is correct
- Check Resend dashboard → Emails for delivery status

## Update Sender Email (Optional)

The function currently uses `onboarding@resend.dev` as the sender. To use your own domain:

1. **Verify domain in Resend**:
   - Go to Resend Dashboard → Domains
   - Add your domain
   - Add DNS records as instructed

2. **Update the function**:
   - Change `from: 'Pipetooling <onboarding@resend.dev>'` 
   - To: `from: 'Pipetooling <noreply@yourdomain.com>'`
   - Redeploy the function

## Next Steps

Once this works, you can:
1. Update other Edge Functions (`invite-user`, `login-as-user`) to use Resend
2. Implement workflow stage notification emails
3. Customize email templates further
