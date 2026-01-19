-- Migration: Rename 'owner' role to 'dev'
-- This migration updates the user_role enum, existing data, functions, and RLS policies
--
-- IMPORTANT: Run Step 1 (ALTER TYPE) separately if you get transaction errors
-- Some PostgreSQL versions require ALTER TYPE to run outside transaction blocks

-- ============================================================================
-- STEP 1: Add 'dev' to the user_role enum type
-- ============================================================================
-- Run this FIRST if 'dev' doesn't exist in the enum:
-- ALTER TYPE user_role ADD VALUE 'dev';
--
-- Or if your PostgreSQL version supports it:
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dev';

-- ============================================================================
-- STEP 2: Update existing user records from 'owner' to 'dev'
-- ============================================================================
UPDATE public.users
SET role = 'dev'::user_role
WHERE role = 'owner'::user_role;

-- ============================================================================
-- STEP 3: Create is_dev() function FIRST (before updating policies)
-- ============================================================================
-- We must create is_dev() before we can update policies to use it
CREATE OR REPLACE FUNCTION public.is_dev()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'dev'
  );
$$;

-- ============================================================================
-- STEP 4: Update all RLS policies to use is_dev() instead of is_owner()
-- ============================================================================
-- We need to update all policies that use is_owner() to use is_dev() instead
-- This must be done BEFORE we can drop is_owner()
--
-- We'll query pg_policy directly to get the actual policy expressions,
-- replace is_owner() with is_dev(), and recreate each policy

DO $$
DECLARE
    pol_record RECORD;
    qual_expr TEXT;
    with_check_expr TEXT;
    new_qual TEXT;
    new_with_check TEXT;
    cmd_type TEXT;
BEGIN
    -- Loop through all policies in public schema that use is_owner()
    FOR pol_record IN
        SELECT 
            n.nspname as schema_name,
            c.relname as table_name,
            p.polname as policy_name,
            CASE p.polcmd
                WHEN 'r' THEN 'SELECT'
                WHEN 'a' THEN 'INSERT'
                WHEN 'w' THEN 'UPDATE'
                WHEN 'd' THEN 'DELETE'
                WHEN '*' THEN 'ALL'
            END as cmd,
            pg_get_expr(p.polqual, p.polrelid) as qual,
            pg_get_expr(p.polwithcheck, p.polrelid) as with_check
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND (
            pg_get_expr(p.polqual, p.polrelid) LIKE '%is_owner()%' OR
            pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%is_owner()%'
        )
    LOOP
        qual_expr := pol_record.qual;
        with_check_expr := pol_record.with_check;
        cmd_type := pol_record.cmd;
        
        -- Replace is_owner() with is_dev() in both expressions
        new_qual := qual_expr;
        new_with_check := with_check_expr;
        
        IF qual_expr IS NOT NULL AND qual_expr LIKE '%is_owner()%' THEN
            new_qual := REPLACE(qual_expr, 'is_owner()', 'is_dev()');
        END IF;
        
        IF with_check_expr IS NOT NULL AND with_check_expr LIKE '%is_owner()%' THEN
            new_with_check := REPLACE(with_check_expr, 'is_owner()', 'is_dev()');
        END IF;
        
        -- Skip if nothing changed
        IF new_qual = qual_expr AND new_with_check = with_check_expr THEN
            CONTINUE;
        END IF;
        
        -- Drop the existing policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol_record.policy_name, 
            pol_record.schema_name, 
            pol_record.table_name);
        
        -- Recreate the policy with is_dev() instead of is_owner()
        IF cmd_type = 'ALL' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR ALL USING (%s) WITH CHECK (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_qual, 'true'),
                COALESCE(new_with_check, 'true')
            );
        ELSIF cmd_type = 'SELECT' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR SELECT USING (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_qual, 'true')
            );
        ELSIF cmd_type = 'INSERT' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_with_check, 'true')
            );
        ELSIF cmd_type = 'UPDATE' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_qual, 'true'),
                COALESCE(new_with_check, 'true')
            );
        ELSIF cmd_type = 'DELETE' THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I.%I FOR DELETE USING (%s)',
                pol_record.policy_name,
                pol_record.schema_name,
                pol_record.table_name,
                COALESCE(new_qual, 'true')
            );
        END IF;
        
        RAISE NOTICE 'Updated policy % on %.%', pol_record.policy_name, pol_record.schema_name, pol_record.table_name;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Now we can safely drop is_owner() function
-- ============================================================================
-- All policies have been updated to use is_dev(), so we can now drop is_owner()
DROP FUNCTION IF EXISTS public.is_owner();

-- ============================================================================
-- STEP 6: Update claim_owner_with_code() function
-- ============================================================================
DROP FUNCTION IF EXISTS public.claim_owner_with_code(text);
CREATE OR REPLACE FUNCTION public.claim_dev_with_code(code_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF code_input = 'admin1234' THEN
    UPDATE public.users
    SET role = 'dev'::user_role
    WHERE id = auth.uid();
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- ============================================================================
-- STEP 7: Add documentation comments
-- ============================================================================
COMMENT ON TYPE user_role IS 'User role enum: dev (formerly owner), master_technician, assistant, subcontractor';
COMMENT ON FUNCTION public.is_dev() IS 'Checks if current user has dev role (formerly is_owner)';
COMMENT ON FUNCTION public.claim_dev_with_code(text) IS 'Grants dev role if code matches admin1234 (formerly claim_owner_with_code)';

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. The 'owner' enum value will remain in the type but should not be used
-- 2. All application code now uses 'dev' instead of 'owner'
-- 3. If you need to completely remove 'owner' from the enum, you would need to:
--    - Create a new enum type
--    - Alter all columns to use the new type
--    - Drop the old enum type
--    This is complex and risky, so leaving 'owner' as deprecated is recommended
