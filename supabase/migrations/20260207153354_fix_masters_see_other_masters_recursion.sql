-- Fix infinite recursion in "Masters and devs can see other masters" policy
-- Solution: Use SECURITY DEFINER function to bypass RLS

-- Create helper function to check if current user is master or dev
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION public.is_master_or_dev()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  );
$$;

COMMENT ON FUNCTION public.is_master_or_dev() IS 'Checks if the current user is a dev or master_technician. Uses SECURITY DEFINER to bypass RLS and avoid recursion.';

-- Drop the problematic policy
DROP POLICY IF EXISTS "Masters and devs can see other masters" ON public.users;

-- Recreate using the SECURITY DEFINER function
CREATE POLICY "Masters and devs can see other masters"
ON public.users
FOR SELECT
USING (
  role = 'master_technician'
  AND is_master_or_dev()
);

COMMENT ON POLICY "Masters and devs can see other masters" ON public.users IS 'Allows masters and devs to view all master_technician users. Required for master sharing feature. Uses SECURITY DEFINER function to avoid recursion.';
