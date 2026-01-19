# Fix: RLS Policy for People Table - Allow Devs to Read All Entries

## The Problem

You're seeing this message:
```
Note: All 2 visible people entries belong to you. The RLS policy for the 'people' table may be restricting access to other users' entries. To see people created by other users, the RLS policy needs to allow owners to read all entries.
```

This means the RLS policy on the `people` table only allows users to see their own entries (`master_user_id = auth.uid()`), but devs should be able to see all people entries.

## Quick Fix

Run this SQL in your Supabase Dashboard → SQL Editor:

```sql
-- Allow devs to read all people entries
DROP POLICY IF EXISTS "Devs can read all people" ON public.people;

CREATE POLICY "Devs can read all people"
ON public.people
FOR SELECT
USING (public.is_dev());
```

## Step-by-Step Instructions

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
   - The policy has been created

5. **Test**
   - Go back to your app
   - Navigate to the People page
   - You should now see all people entries, not just your own
   - The warning message should disappear

## How It Works

- **Existing policies**: Users can see/manage their own people entries (where `master_user_id = auth.uid()`)
- **New policy**: Devs can see ALL people entries (using `is_dev()` function)
- **Combined effect**: 
  - Regular users: See only their own entries
  - Devs: See all entries (their own + everyone else's)

## Verify It's Working

After running the SQL:

1. **Check the policy exists**:
   ```sql
   SELECT policyname FROM pg_policies 
   WHERE tablename = 'people' 
   AND schemaname = 'public'
   AND policyname = 'Devs can read all people';
   ```
   - Should return the policy name

2. **Test as a dev user**:
   - Sign in as a dev user
   - Go to People page
   - You should see all people entries from all users
   - The warning message should be gone

3. **Test as a regular user**:
   - Sign in as a non-dev user (master_technician, assistant, etc.)
   - Go to People page
   - You should only see your own people entries (existing behavior)

## Still Not Working?

If you still only see your own entries:

1. **Verify you're a dev**:
   ```sql
   SELECT role FROM public.users WHERE id = auth.uid();
   ```
   - Should return `'dev'`
   - If not, update it or use the admin code in Settings

2. **Verify `is_dev()` function exists**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'is_dev';
   ```
   - Should return `is_dev`
   - If not, you need to run the `rename_owner_to_dev` migration first

3. **Test the function**:
   ```sql
   SELECT public.is_dev();
   ```
   - Should return `true` if you're a dev
   - Should return `false` if you're not

4. **Check existing policies**:
   ```sql
   SELECT policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'people' 
   AND schemaname = 'public';
   ```
   - Should show all policies on the people table
   - The new "Devs can read all people" policy should be listed

## Optional: Also Allow Devs to Manage All People

If you want devs to be able to edit/delete all people entries (not just read), you can add:

```sql
-- Allow devs to update all people entries
DROP POLICY IF EXISTS "Devs can update all people" ON public.people;
CREATE POLICY "Devs can update all people"
ON public.people
FOR UPDATE
USING (public.is_dev())
WITH CHECK (public.is_dev());

-- Allow devs to delete all people entries
DROP POLICY IF EXISTS "Devs can delete all people" ON public.people;
CREATE POLICY "Devs can delete all people"
ON public.people
FOR DELETE
USING (public.is_dev());
```

**Note**: Be careful with delete permissions - devs will be able to delete anyone's people entries.
