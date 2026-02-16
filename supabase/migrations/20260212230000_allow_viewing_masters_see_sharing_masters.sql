-- Allow viewing masters and their assistants to see sharing masters' user rows.
-- This enables "Created by [name]" to display correctly when Malachi/Taunya
-- view shared people (e.g., Robert's subcontractors). Without this, the users
-- table RLS blocks reading dev/master rows, so creator name shows as "Unknown".
--
-- Uses SECURITY DEFINER function to avoid infinite recursion: the policy cannot
-- inline-query master_shares/master_assistants because their RLS policies
-- reference users, causing recursion.

-- Create helper function - SECURITY DEFINER bypasses RLS, breaking recursion
CREATE OR REPLACE FUNCTION public.can_see_sharing_master(sharing_master_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.master_shares ms
    WHERE ms.sharing_master_id = can_see_sharing_master.sharing_master_id
    AND (
      ms.viewing_master_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = ms.viewing_master_id
        AND ma.assistant_id = auth.uid()
      )
    )
  );
$$;

DROP POLICY IF EXISTS "Users can see sharing masters who shared with them or their master" ON public.users;

CREATE POLICY "Users can see sharing masters who shared with them or their master"
ON public.users
FOR SELECT
USING (public.can_see_sharing_master(users.id));
