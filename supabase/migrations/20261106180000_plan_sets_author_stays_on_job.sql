SET lock_timeout = '3s';

-- Plan sets by part (#239): an as-built's author stays on the job.
--
-- plan_sets_update (20261101210000) let the author of an as-built change any column of their own row, part_id and
-- job_id included, so a crew member could aim their as-built at another job, or another part, that they are not on;
-- the edge function plan-set-files closed its own door to that in v2.6345 and the card named the policy as what was
-- left. The insert rule already held the crew to a job they are on whose part is the set's. This migration gives
-- that rule one home, plan_set_crew_on_job, and asks it on the update as well as the insert, so a changed row has
-- to pass exactly what a new one does.
--
-- The predicate is SECURITY DEFINER with row_security off, as helper_on_job (20261014220000) is: the inline EXISTS
-- on jobs_ledger_team_members ran under the caller's RLS, and that table's SELECT policy (20260907050000) leaves
-- helpers out, so a helper never saw their own crew row. The office branch (plan_part_can_write) is untouched, and the
-- restrictive fences (training mode, the twin fence, the archived seal, primary scope) still apply on top.
--
-- No CREATE TABLE. Idempotent: CREATE OR REPLACE and DROP POLICY IF EXISTS.

CREATE OR REPLACE FUNCTION public.plan_set_crew_on_job(p_job_id uuid, p_part_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p_job_id IS NOT NULL AND p_part_id IS NOT NULL AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members m
      WHERE m.job_id = p_job_id AND m.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.id = p_job_id AND j.plan_part_id = p_part_id
    );
$$;

COMMENT ON FUNCTION public.plan_set_crew_on_job(uuid, uuid) IS
  'Plan sets by part (#239): the signed-in user is on this job''s crew (jobs_ledger_team_members) and the job builds from this part. The crew''s own as-built or paper is kept, and changed, only on such a job. SECURITY DEFINER + row_security off, so a helper''s answer does not hang on their team-members visibility.';

REVOKE EXECUTE ON FUNCTION public.plan_set_crew_on_job(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_set_crew_on_job(uuid, uuid) TO authenticated, service_role;

-- A new set: the office on any part it can see; a crew member an as-built or a paper on a job they are on whose part
-- is the set's (20261102010000's rule, through the one predicate).
DROP POLICY IF EXISTS plan_sets_insert ON public.plan_sets;
CREATE POLICY plan_sets_insert ON public.plan_sets
  FOR INSERT TO authenticated WITH CHECK (
    public.plan_part_can_write(part_id)
    OR (
      (kind = 'as_built' OR NOT public.plan_set_is_drawing(kind))
      AND public.plan_part_can_see(part_id)
      AND public.plan_set_crew_on_job(job_id, part_id)
    )
  );

-- A changed set: the office as before; the author of an as-built may change their own row, and the row they leave
-- behind must still be an as-built of theirs on a job they are on whose part is the set's — so job_id and part_id can
-- move only between such jobs, never to one they are not on.
DROP POLICY IF EXISTS plan_sets_update ON public.plan_sets;
CREATE POLICY plan_sets_update ON public.plan_sets
  FOR UPDATE TO authenticated USING (
    public.plan_part_can_write(part_id)
    OR (kind = 'as_built' AND created_by = (SELECT auth.uid()))
  ) WITH CHECK (
    public.plan_part_can_write(part_id)
    OR (
      kind = 'as_built' AND created_by = (SELECT auth.uid())
      AND public.plan_part_can_see(part_id)
      AND public.plan_set_crew_on_job(job_id, part_id)
    )
  );
