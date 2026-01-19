# Test Email Edge Function

This Edge Function allows owners to send test emails using email templates.

## Usage

Call from the frontend:
```typescript
const { data, error } = await supabase.functions.invoke('test-email', {
  body: {
    to: 'test@example.com',
    subject: 'Test Subject',
    body: 'Test body content',
    template_type: 'invitation',
  },
})
```

## Authentication

- Requires valid JWT token in Authorization header
- Only owners can send test emails
- Validates email format

## Email Sending

**Current Status**: The function validates and prepares emails but uses Supabase's default email templates.

**To Use Custom Templates**: You need to integrate with an external email service. Options:

### Option 1: SendGrid
1. Get SendGrid API key
2. Add to Edge Function secrets: `supabase secrets set SENDGRID_API_KEY=your_key`
3. Uncomment and configure SendGrid code in `index.ts`

### Option 2: Mailgun
1. Get Mailgun API key and domain
2. Add to Edge Function secrets
3. Add Mailgun integration code

### Option 3: AWS SES
1. Configure AWS SES
2. Add AWS credentials to secrets
3. Add SES integration code

### Option 4: Resend
1. Get Resend API key
2. Add to secrets
3. Add Resend integration code

The function currently:
- ✅ Validates authentication (owner only)
- ✅ Validates email format
- ✅ Prepares email with custom subject/body
- ⚠️ Sends via Supabase invite (uses default template)
- 📝 Logs email content for debugging

To enable custom templates, uncomment the external email service code and configure your provider.

## Deployment

### Via Supabase CLI:
```bash
cd supabase/functions/test-email
supabase functions deploy test-email
```

### Via Supabase Dashboard:
1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it `test-email`
4. Copy the code from `index.ts`
5. Deploy

## Using Resend (Recommended for Custom Templates)

For full email template support, use Resend:

1. **Sign up** at https://resend.com (free tier available)
2. **Get API key** from Resend dashboard
3. **Set secret**:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```
4. **Replace `index.ts`** with `index-with-resend.ts`:
   ```bash
   cp index-with-resend.ts index.ts
   ```
5. **Update sender email** in the code (line with `from:`)
6. **Deploy** the function

Resend offers:
- ✅ Custom email templates
- ✅ HTML email support
- ✅ Free tier (3,000 emails/month)
- ✅ Easy integration
- ✅ Good deliverability

## Environment Variables

Uses Supabase environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key

These are automatically available in Edge Functions.
