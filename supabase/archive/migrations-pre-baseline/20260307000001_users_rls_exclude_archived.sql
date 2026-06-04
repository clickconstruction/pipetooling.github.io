-- Exclude archived users from visibility for non-devs.
-- Devs see all users (including archived). Others see only archived_at IS NULL.
DROP POLICY IF EXISTS "Users can select users" ON public.users;

CREATE POLICY "Users can select users"
ON public.users FOR SELECT
USING (
  (archived_at IS NULL OR public.is_dev())
  AND (
    id = auth.uid()
    OR public.is_dev()
    OR (role = 'master_technician' AND public.is_master_or_dev())
    OR (role = 'assistant')
    OR (role IN ('master_technician', 'dev') AND public.is_estimator())
    OR (role = 'estimator')
    OR (role = 'primary')
    OR (role = 'subcontractor')
    OR public.master_adopted_current_user(id)
    OR public.can_see_sharing_master(id)
  )
);
