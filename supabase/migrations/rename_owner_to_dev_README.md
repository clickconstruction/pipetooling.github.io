# Migration: Rename 'owner' Role to 'dev'

This migration updates the database to change the 'owner' role to 'dev'.

## What This Migration Does

1. **Updates existing user records**: Changes all users with role 'owner' to 'dev'
2. **Adds 'dev' to enum**: Adds 'dev' as a new value to the `user_role` enum type
3. **Creates `is_dev()` function**: Creates the new function before updating policies (required because policies depend on the function)
4. **Updates ALL RLS policies**: Automatically finds and updates all RLS policies that reference `is_owner()` to use `is_dev()` instead. This includes policies on:
   - `users` table (3 policies)
   - `customers` table (4 policies)
   - `master_assistants` table (2 policies)
   - `project_workflow_steps` table (4 policies)
   - `project_workflows` table (2 policies)
   - `projects` table (4 policies)
   - `workflow_step_dependencies` table (4 policies)
   - `workflow_template_steps` table (2 policies)
   - `workflow_templates` table (5 policies)
   - `project_workflow_step_actions` table (1 policy)
   - And any other policies that use `is_owner()`
5. **Drops `is_owner()` function**: Safely removes the old function after all policies are updated
6. **Renames `claim_owner_with_code()`**: Updates to `claim_dev_with_code()`

## Important Notes

- **Enum value 'owner' remains**: PostgreSQL doesn't support removing enum values easily. The 'owner' value will remain in the enum but should not be used. All application code now uses 'dev'.
- **RLS Policy Updates**: The migration uses a `DO` block to automatically find all policies that use `is_owner()` by querying `pg_policy` system catalog. It then:
  1. Extracts the policy expressions using `pg_get_expr()`
  2. Replaces `is_owner()` with `is_dev()` in both USING and WITH CHECK clauses
  3. Drops and recreates each policy with the updated expression
  4. Preserves the exact policy logic while only changing the function call
- **Function dependency order**: The migration creates `is_dev()` first, then updates all policies, then drops `is_owner()`. This is critical because PostgreSQL won't allow dropping a function that has dependent objects (like RLS policies).
- **Safe to run multiple times**: The migration uses `IF NOT EXISTS` and `IF EXISTS` checks where possible, but it's best to run it only once.
- **Backup recommended**: Always backup your database before running migrations.

## How to Apply

### Option 1: Via Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste the entire contents of `rename_owner_to_dev.sql`
4. Click "Run"
5. Verify the migration completed successfully

### Option 2: Via Supabase CLI

```bash
# From the project root
supabase db push
```

Or apply the specific migration:

```bash
# If using Supabase MCP
# The migration will be applied when you run migrations
```

## Verification

After running the migration, verify:

1. **Check user roles**:
   ```sql
   SELECT id, email, role FROM public.users WHERE role = 'dev';
   -- Should show users that were previously 'owner'
   ```

2. **Check functions exist**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname IN ('is_dev', 'claim_dev_with_code');
   -- Should return both function names
   ```

3. **Test the functions**:
   ```sql
   -- Test is_dev() (must be logged in as a dev user)
   SELECT public.is_dev();
   
   -- Test claim_dev_with_code() (must be logged in)
   SELECT public.claim_dev_with_code('admin1234');
   ```

4. **Check enum values**:
   ```sql
   SELECT enumlabel FROM pg_enum 
   WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
   ORDER BY enumsortorder;
   -- Should include both 'dev' and 'owner' (owner is deprecated)
   ```

## Rollback (if needed)

If you need to rollback this migration:

1. Update users back to 'owner':
   ```sql
   UPDATE public.users SET role = 'owner'::user_role WHERE role = 'dev'::user_role;
   ```

2. Recreate old functions:
   ```sql
   DROP FUNCTION IF EXISTS public.is_dev();
   CREATE OR REPLACE FUNCTION public.is_owner()
   RETURNS boolean
   LANGUAGE sql
   SECURITY DEFINER
   STABLE
   AS $$
     SELECT EXISTS (
       SELECT 1 FROM public.users 
       WHERE id = auth.uid() 
       AND role = 'owner'
     );
   $$;
   
   DROP FUNCTION IF EXISTS public.claim_dev_with_code(text);
   CREATE OR REPLACE FUNCTION public.claim_owner_with_code(code_input text)
   RETURNS boolean
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   BEGIN
     IF code_input = 'admin1234' THEN
       UPDATE public.users
       SET role = 'owner'
       WHERE id = auth.uid();
       RETURN TRUE;
     END IF;
     RETURN FALSE;
   END;
   $$;
   ```

3. Update RLS policies back to 'owner' (reverse the policy changes)

## Troubleshooting

### Error: "enum value 'dev' already exists"
- This means the migration was already run. You can safely skip this step or comment it out.

### Error: "cannot drop function is_owner() because other objects depend on it"
- **This error should be resolved in the current migration version**. The migration now:
  1. Creates `is_dev()` first
  2. Updates all dependent RLS policies to use `is_dev()` instead of `is_owner()`
  3. Then drops `is_owner()`
- If you still see this error, it means some policies weren't updated. Check which policies still reference `is_owner()`:
  ```sql
  SELECT 
      n.nspname as schema_name,
      c.relname as table_name,
      p.polname as policy_name,
      pg_get_expr(p.polqual, p.polrelid) as qual,
      pg_get_expr(p.polwithcheck, p.polrelid) as with_check
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  AND (
      pg_get_expr(p.polqual, p.polrelid) LIKE '%is_owner()%' OR
      pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%is_owner()%'
  );
  ```

### Error: "function is_owner() does not exist"
- This is fine - it means the function was already renamed or never existed. The migration will create `is_dev()`.

### Error: "column role is of type user_role but expression is of type text"
- Make sure you're casting: `'dev'::user_role` not just `'dev'`

### Error: "ALTER TYPE ... ADD VALUE cannot run inside a transaction block"
- Some PostgreSQL versions require `ALTER TYPE ADD VALUE` to run outside a transaction. Run this separately first:
  ```sql
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dev';
  ```
- Then run the rest of the migration.

### Users still showing 'owner' role
- Check if the UPDATE statement ran successfully
- Verify the enum value 'dev' exists
- Try running the UPDATE statement manually

### Policies not updated correctly
- The migration should automatically update all policies, but if some are missed:
  1. Check the migration output for NOTICE messages showing which policies were updated
  2. Manually verify policies using the query in the "cannot drop function" section above
  3. If needed, manually update specific policies:
     ```sql
     -- Example: Update a specific policy
     DROP POLICY IF EXISTS "Policy Name" ON public.table_name;
     CREATE POLICY "Policy Name" ON public.table_name 
     FOR SELECT USING (public.is_dev() OR ...);
     ```
