# Deploy Delete User Function

This Edge Function allows devs to delete users from the system.

## Prerequisites

1. **Service Role Key** - Required for admin operations (deleting from `auth.users`)
2. **Supabase CLI** (optional) - Or use the Dashboard method

## Step 1: Set Service Role Key Secret

The function needs `SUPABASE_SERVICE_ROLE_KEY` to perform admin operations:

1. Go to Supabase Dashboard → Settings → API
2. Copy your **Service Role Key** (starts with `eyJ...`, keep this secret!)
3. Go to Edge Functions → Secrets
4. Add secret:
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
   - Name: `delete-user`

4. **Copy the Code**
   - Open `supabase/functions/delete-user/index.ts` from your project
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
supabase functions deploy delete-user --no-verify-jwt
```

## Step 3: Verify Deployment

After deployment, you should see:
- Function listed in Edge Functions
- Status: Active/Deployed
- Verify JWT: Disabled

## Step 4: Test the Function

1. **Go to Settings page** in your app (as a dev user)
2. **Click "Delete user"** button
3. **Enter email or name** of user to delete
4. **Click "Delete user"**
5. **Verify** the user is deleted

## Function Details

**Function Name**: `delete-user`

**Authentication**: 
- Requires valid JWT token
- Only devs can delete users

**Input**:
```typescript
{
  email?: string,    // Email of user to delete (optional if name provided)
  name?: string      // Name of user to delete (optional if email provided)
}
```

**Behavior**:
- Finds user by email (if provided) or name (if email not found)
- Prevents deleting your own account
- Deletes from `auth.users` (requires service role)
- Deletes from `public.users`
- Returns success message

**Security**:
- Only devs can call this function
- Cannot delete your own account
- Uses service role key for admin operations (server-side only)

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

### "Forbidden - Only devs can delete users"
- **Cause**: Your user role is not 'dev'
- **Solution**: 
  1. Go to Settings → Admin Code
  2. Enter code: `admin1234`
  3. Or update your role in database

### "User not found"
- **Cause**: No user matches the provided email or name
- **Solution**: 
  1. Verify the email/name is correct
  2. Check the user exists in the database
  3. Try using email instead of name (more reliable)

### "Cannot delete your own account"
- **Cause**: Trying to delete yourself
- **Solution**: This is by design - you cannot delete your own account for safety

## Security Notes

- ⚠️ **Service Role Key**: Never expose this in client-side code
- ⚠️ **User Deletion**: This is permanent and cannot be undone
- ✅ **Access Control**: Only devs can delete users
- ✅ **Self-Protection**: Cannot delete your own account

## Related Functions

- `create-user` - Manually create users
- `invite-user` - Send invitation emails
- `login-as-user` - Impersonate users
