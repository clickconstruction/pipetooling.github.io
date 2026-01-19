# Fix: RLS Policy Error for Email Templates

## The Problem

You're getting this error when trying to save an email template:
```
new row violates row-level security policy for table "email_templates"
```

This happens because the RLS policies are checking your role, but either:
1. Your user role isn't `'dev'`
2. The RLS policies need to be updated to use the `is_dev()` function

## Quick Fix: Update RLS Policies

Run this SQL in your Supabase Dashboard → SQL Editor:

```sql
-- Fix RLS policies for email_templates table
-- Drop existing policies
DROP POLICY IF EXISTS "Owners can read email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Owners can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Owners can update email templates" ON public.email_templates;

-- Recreate policies using is_dev() function
CREATE POLICY "Devs can read email templates"
ON public.email_templates
FOR SELECT
USING (public.is_dev());

CREATE POLICY "Devs can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (public.is_dev());

CREATE POLICY "Devs can update email templates"
ON public.email_templates
FOR UPDATE
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- Optional: Add delete policy if needed
CREATE POLICY "Devs can delete email templates"
ON public.email_templates
FOR DELETE
USING (public.is_dev());
```

## Step-by-Step Instructions

### Option 1: Via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**
   - Open https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Run the SQL**
   - Copy the SQL code above
   - Paste it into the SQL editor
   - Click **Run** (or press Ctrl+Enter / Cmd+Enter)

4. **Verify**
   - You should see "Success. No rows returned"
   - The policies have been updated

5. **Test**
   - Go back to your app
   - Try saving an email template again
   - Should work now!

### Option 2: Check Your Role First

If you're still getting the error after running the SQL above, verify your role:

1. **Check your role in the app**:
   - Go to Settings → Admin Code
   - If you see the admin code input, you're not a `dev` yet
   - Enter code: `admin1234` to become a `dev`

2. **Or check via SQL**:
   ```sql
   SELECT id, email, role FROM public.users WHERE id = auth.uid();
   ```
   - Your role should be `'dev'`
   - If it's not, update it:
     ```sql
     UPDATE public.users SET role = 'dev'::user_role WHERE id = auth.uid();
     ```

## Why This Happens

The original RLS policies were checking:
```sql
EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND role = 'dev'
)
```

This direct query can cause issues. The `is_dev()` function is designed to:
- Avoid recursion issues
- Be more efficient
- Work consistently across all policies

## Still Not Working?

If you still get the error:

1. **Verify `is_dev()` function exists**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'is_dev';
   ```
   - Should return `is_dev`
   - If not, you need to run the `rename_owner_to_dev` migration first

2. **Check your role**:
   ```sql
   SELECT role FROM public.users WHERE id = auth.uid();
   ```
   - Must be `'dev'`

3. **Test the function**:
   ```sql
   SELECT public.is_dev();
   ```
   - Should return `true` if you're a dev
   - Should return `false` if you're not

4. **Check policy exists**:
   ```sql
   SELECT policyname FROM pg_policies 
   WHERE tablename = 'email_templates' 
   AND schemaname = 'public';
   ```
   - Should show the new policy names with "Devs" instead of "Owners"

## Alternative: Temporary Fix

If you need to create templates immediately and can't wait:

1. **Temporarily disable RLS** (NOT RECOMMENDED for production):
   ```sql
   ALTER TABLE public.email_templates DISABLE ROW LEVEL SECURITY;
   ```
   - Create your templates
   - Then re-enable RLS:
     ```sql
     ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
     ```
   - Then run the policy fix above

**Warning**: Only do this if you understand the security implications. It temporarily removes all access control.
