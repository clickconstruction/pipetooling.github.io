# Fix: "Invalid JWT (Status: 401)" Error

## Problem
The Edge Function is returning "Invalid JWT" when called from the frontend.

## Solution

I've updated the Edge Function to properly extract and validate the JWT token. However, you need to **redeploy the function** with the updated code.

### Updated Code
The function now:
1. Extracts the JWT token from the Authorization header
2. Passes it explicitly to `getUser(token)` for validation

### Steps to Fix

1. **Update the deployed function** in Supabase Dashboard:
   - Go to Supabase Dashboard → Edge Functions → `test-email`
   - Click "Edit"
   - Copy the updated code from `supabase/functions/test-email/index.ts`
   - Paste it into the function editor
   - Click "Deploy"

2. **Verify function configuration**:
   - The function should have `verify_jwt: false` in its config (or use `--no-verify-jwt` flag)
   - This allows the function to manually validate JWTs (which we're doing)

3. **Test again**:
   - Go to Settings → Email Templates
   - Click "Test Email" button
   - Enter your email
   - Should work now!

## Alternative: Check Function Configuration

If the error persists, check the function's JWT verification setting:

1. In Supabase Dashboard → Edge Functions → `test-email`
2. Check if there's a "Verify JWT" toggle or setting
3. If it's enabled, you have two options:
   - **Option A**: Disable it (set `verify_jwt: false`) and use manual validation (current code)
   - **Option B**: Enable it and remove manual JWT validation from the code

## Current Code Changes

The function now:
- ✅ Extracts JWT: `const token = authHeader.replace(/^Bearer\s+/i, '')`
- ✅ Validates explicitly: `await supabase.auth.getUser(token)`
- ✅ Better error messages

The frontend code should work as-is - the Supabase client automatically includes the JWT token.

## Still Not Working?

1. **Check browser console** for more error details
2. **Check Supabase logs** → Edge Functions → `test-email` → Logs
3. **Verify you're logged in** - try signing out and back in
4. **Check your role** - make sure you're a dev
