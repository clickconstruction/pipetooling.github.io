-- Restrict public.people INSERT to dev, master_technician, and assistant only.
-- Estimators (and other roles) were able to insert via "Users can insert own people"
-- because WITH CHECK only required master_user_id = auth.uid().
-- ACCESS_CONTROL.md: Create people — estimator (and primary, sub, etc.) denied.

DROP POLICY IF EXISTS "Users can insert own people" ON public.people;

CREATE POLICY "Users can insert own people"
ON public.people
FOR INSERT
WITH CHECK (
  master_user_id = auth.uid()
  AND (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('master_technician', 'assistant')
    )
  )
);

COMMENT ON POLICY "Users can insert own people" ON public.people IS
  'Roster insert: own master_user_id only; dev, master_technician, or assistant (per ACCESS_CONTROL People Management).';
