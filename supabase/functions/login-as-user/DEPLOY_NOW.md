# Quick Deploy: login-as-user

## The Problem
You're getting a 401 Unauthorized error because the `login-as-user` Edge Function doesn't exist yet.

## Quick Fix: Deploy via Supabase Dashboard

### Step 1: Set Service Role Key Secret (IMPORTANT!)

**⚠️ CRITICAL**: This function needs the service role key to generate magic links.

1. Go to Supabase Dashboard → **Settings** → **API**
2. Find **Service Role Key** (starts with `eyJ...`)
3. **Copy it** (keep it secret - never expose in client code!)
4. Go to **Edge Functions** → **Secrets**
5. If `SUPABASE_SERVICE_ROLE_KEY` doesn't exist, add it:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: Paste your service role key
   - Click **"Add Secret"**

**Note**: If you already set this for `delete-user`, you can skip this step.

### Step 2: Deploy the Function

1. **Go to Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"**
3. **Function Name**: `login-as-user` (exact match, with hyphens)
4. **Copy the code** from `supabase/functions/login-as-user/index.ts`
5. **Paste it** into the function editor
6. **Important**: Set **"Verify JWT"** to **DISABLED** (unchecked)
7. Click **"Deploy"**
8. Wait 10-30 seconds

### Step 3: Test

1. Go back to your app
2. Go to Settings → Users
3. Click "Login as user" next to a user
4. Should work now!

## Troubleshooting

### Still getting 401 Unauthorized?

1. **Check function is deployed**:
   - Go to Edge Functions list
   - Should see `login-as-user` with status "Active"

2. **Check JWT is disabled**:
   - Click on `login-as-user` function
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

### "Forbidden - Only devs and masters can login as other users"

- Make sure you're signed in as a dev or master user
- Go to Settings → Admin Code
- Enter code: `admin1234` to become a dev

### "User not found"

- Verify the email address is correct
- Check that the user exists in the database
- Make sure email matches exactly

## Security Warning

⚠️ **Service Role Key**:
- Has full admin access to your database
- Never expose it in client-side code
- Only use it in Edge Functions (server-side)
- Keep it secret!
