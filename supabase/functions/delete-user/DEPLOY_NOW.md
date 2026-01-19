# Quick Deploy: delete-user

## The Problem
You're getting "Session invalid or expired" because the `delete-user` Edge Function doesn't exist yet.

## Quick Fix: Deploy via Supabase Dashboard

### Step 1: Set Service Role Key Secret (IMPORTANT!)

**⚠️ CRITICAL**: This function needs the service role key to delete users.

1. Go to Supabase Dashboard → **Settings** → **API**
2. Find **Service Role Key** (starts with `eyJ...`)
3. **Copy it** (keep it secret - never expose in client code!)
4. Go to **Edge Functions** → **Secrets**
5. Add new secret:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Paste your service role key
   - Click **"Add Secret"**

### Step 2: Deploy the Function

1. **Go to Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"**
3. **Function Name**: `delete-user` (exact match, with hyphen)
4. **Copy the code** from `supabase/functions/delete-user/index.ts`
5. **Paste it** into the function editor
6. **Important**: Set **"Verify JWT"** to **DISABLED** (unchecked)
7. Click **"Deploy"**
8. Wait 10-30 seconds

### Step 3: Test

1. Go back to your app
2. Go to Settings → Delete user
3. Enter email or name of a user to delete
4. Click "Delete user"
5. Should work now!

## Troubleshooting

### Still getting "Session invalid or expired"?

1. **Check function is deployed**:
   - Go to Edge Functions list
   - Should see `delete-user` with status "Active"

2. **Check JWT is disabled**:
   - Click on `delete-user` function
   - Verify JWT should show "Disabled"

3. **Try signing out and back in**:
   - Sometimes the session needs to be refreshed
   - Sign out → Sign in → Try again

4. **Check browser console**:
   - Look for detailed error messages
   - The function might be returning a specific error

### "SUPABASE_SERVICE_ROLE_KEY not configured"

- Go to Edge Functions → Secrets
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set
- Get the key from Settings → API → Service Role Key

### "Forbidden - Only devs can delete users"

- Make sure you're signed in as a dev user
- Go to Settings → Admin Code
- Enter code: `admin1234` to become a dev

## Security Warning

⚠️ **Service Role Key**:
- Has full admin access to your database
- Never expose it in client-side code
- Only use it in Edge Functions (server-side)
- Keep it secret!
