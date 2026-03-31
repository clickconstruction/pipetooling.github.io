-- Fix users RLS to allow seeing masters who own projects/customers the user has access to
-- This fixes the 406 error when assistants try to load master information for projects
--
-- The issue: Assistants can see projects from masters who adopted them, but can't see
-- the master's user record to display their name/email in the UI.
--
-- Solution: Use a SECURITY DEFINER function to check master_assistants without triggering RLS
-- This avoids recursion because the function bypasses RLS when checking master_assistants

-- Create helper function to check if a master has adopted the current user
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION public.master_adopted_current_user(master_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_adopted_current_user.master_user_id
    AND assistant_id = auth.uid()
  );
$$;

-- Drop policy if it exists (in case we need to recreate it)
DROP POLICY IF EXISTS "Users can see masters who own accessible projects" ON public.users;
DROP POLICY IF EXISTS "Users can see masters who adopted them" ON public.users;

-- Add policy to allow users to see masters who have adopted them
-- Uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Users can see masters who adopted them"
ON public.users
FOR SELECT
USING (
  -- User can see masters who have adopted them (via function to avoid recursion)
  public.master_adopted_current_user(users.id)
  -- OR user can see themselves
  OR users.id = auth.uid()
);

-- Add comments
COMMENT ON FUNCTION public.master_adopted_current_user(UUID) IS 'Checks if the given master has adopted the current user. Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
COMMENT ON POLICY "Users can see masters who adopted them" ON public.users IS 'Allows users to see masters who have adopted them. This enables assistants to see master information when viewing projects. Uses SECURITY DEFINER function to avoid recursion.';
