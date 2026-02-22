-- Primary adoption: primaries see projects from masters who adopted them
-- Trace (primary) adopted by Malachi should see Malachi's projects (e.g. SVP Round Rock New Build)

DROP POLICY IF EXISTS "Users can see projects they own or projects from masters who adopted them or shared with them" ON public.projects;

CREATE POLICY "Users can see projects they own or projects from masters who adopted them or shared with them"
ON public.projects
FOR SELECT
USING (
  master_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician')
  )
  OR EXISTS (
    SELECT 1 FROM public.master_assistants
    WHERE master_id = master_user_id
    AND assistant_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.master_primaries
    WHERE master_id = master_user_id
    AND primary_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.master_shares
    WHERE sharing_master_id = master_user_id
    AND viewing_master_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = customer_id
    AND (
      master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_primaries
        WHERE master_id = master_user_id
        AND primary_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_shares
        WHERE sharing_master_id = master_user_id
        AND viewing_master_id = auth.uid()
      )
    )
  )
);
