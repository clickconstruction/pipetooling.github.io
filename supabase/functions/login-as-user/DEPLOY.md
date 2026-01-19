# Deploy Login As User Function

This Edge Function allows devs to generate magic links to impersonate other users.

## Prerequisites

1. **Service Role Key** - Required for admin operations (generating magic links)
2. **Supabase CLI** (optional) - Or use the Dashboard method

## Step 1: Set Service Role Key Secret

The function needs `SUPABASE_SERVICE_ROLE_KEY` to perform admin operations:

1. Go to Supabase Dashboard → Settings → API
2. Copy your **Service Role Key** (starts with `eyJ...`, keep this secret!)
3. Go to Edge Functions → Secrets
4. Add secret (if not already set):
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Your service role key
   - Click **"Add Secret"**

**⚠️ WARNING**: The service role key has full admin access. Never expose it in client-side code!

## Step 2: Deploy the Function

### Option A: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click **Edge Functions** in the left sidebar
   - Click **"Create a new function"**

3. **Set Function Name**
   - Name: `login-as-user`

4. **Copy the Code**
   - Open `supabase/functions/login-as-user/index.ts` from your project
   - Copy ALL the code
   - Paste it into the function editor in Supabase Dashboard

5. **Configure Function Settings**
   - **Verify JWT**: Set to **DISABLED** (unchecked)
     - The function does manual JWT validation, so gateway verification must be off

6. **Deploy**
   - Click **"Deploy"** button
   - Wait for deployment to complete (usually 10-30 seconds)

### Option B: Via Supabase CLI

From the project root directory:

```bash
cd /Users/robertdouglas/_SYNC/github/Click-Construction/pipetooling/pipetooling.github.io
supabase functions deploy login-as-user --no-verify-jwt
```

## Step 3: Verify Deployment

After deployment, you should see:
- Function listed in Edge Functions
- Status: Active/Deployed
- Verify JWT: Disabled

## Step 4: Test the Function

1. **Go to Settings page** in your app (as a dev user)
2. **Click "Login as user"** button next to a user
3. **Verify** you're redirected to that user's account

## Function Details

**Function Name**: `login-as-user`

**Authentication**: 
- Requires valid JWT token
- Only devs can generate magic links

**Input**:
```typescript
{
  email: string,        // Email of user to impersonate
  redirectTo?: string   // Optional redirect URL after login
}
```

**Output**:
```typescript
{
  success: true,
  action_link: string   // Magic link to sign in as the target user
}
```

**Behavior**:
- Validates the requesting user is a dev
- Finds target user by email
- Generates a magic link using admin API
- Returns the magic link for frontend to use

**Security**:
- Only devs can call this function
- Uses service role key for admin operations (server-side only)
- Magic links are single-use and time-limited

## Troubleshooting

### "Session invalid or expired"
- **Cause**: Function doesn't exist or JWT validation is failing
- **Solution**: 
  1. Verify function is deployed
  2. Check function has JWT verification disabled
  3. Try signing out and back in
  4. Check browser console for detailed error

### "SUPABASE_SERVICE_ROLE_KEY not configured"
- **Cause**: Service role key secret not set
- **Solution**: 
  1. Go to Edge Functions → Secrets
  2. Add `SUPABASE_SERVICE_ROLE_KEY` with your service role key
  3. Get service role key from Settings → API

### "Forbidden - Only devs and masters can login as other users"
- **Cause**: Your user role is not 'dev' or 'master_technician'
- **Solution**: 
  1. Go to Settings → Admin Code
  2. Enter code: `admin1234`
  3. Or update your role in database

### "User not found"
- **Cause**: No user matches the provided email
- **Solution**: 
  1. Verify the email is correct
  2. Check the user exists in the database
  3. Make sure the email matches exactly (case-sensitive)

### "Failed to generate magic link"
- **Cause**: Admin API error
- **Solution**: 
  1. Check Supabase logs for detailed error
  2. Verify service role key is correct
  3. Check that the target user exists in auth.users

## Security Notes

- ⚠️ **Service Role Key**: Never expose this in client-side code
- ⚠️ **Impersonation**: This allows devs to access any user's account
- ✅ **Access Control**: Only devs can generate magic links
- ✅ **Magic Links**: Single-use and time-limited for security

## Related Functions

- `create-user` - Manually create users
- `delete-user` - Delete users
- `invite-user` - Send invitation emails
