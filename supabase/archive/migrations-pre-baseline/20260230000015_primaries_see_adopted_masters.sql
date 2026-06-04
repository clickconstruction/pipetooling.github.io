-- Allow primaries to see masters who have adopted them (master_primaries).
-- Fixes: Primary users (e.g. Trace) could not see their adopting master (e.g. Malachi)
-- in the Send task Notify dropdown on the Dashboard.
--
-- master_adopted_current_user previously only checked master_assistants.
-- Now also checks master_primaries so adopted primaries can see their masters.

CREATE OR REPLACE FUNCTION public.master_adopted_current_user(master_user_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_adopted_current_user.master_user_id
    AND assistant_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.master_primaries
    WHERE master_id = master_adopted_current_user.master_user_id
    AND primary_id = auth.uid()
  );
$$;
COMMENT ON FUNCTION public.master_adopted_current_user(UUID) IS 'Checks if the given master has adopted the current user (as assistant or primary). Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
