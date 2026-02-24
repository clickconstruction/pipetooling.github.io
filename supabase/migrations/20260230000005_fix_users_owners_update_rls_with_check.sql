-- Fix RLS policy: replace WITH CHECK (true) with proper restriction
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy
-- The policy allowed unrestricted access via WITH CHECK (true); now restricts to public.is_dev()

DROP POLICY IF EXISTS "Owners can update users" ON public.users;

CREATE POLICY "Owners can update users"
ON public.users
FOR UPDATE
USING (public.is_dev())
WITH CHECK (public.is_dev());
