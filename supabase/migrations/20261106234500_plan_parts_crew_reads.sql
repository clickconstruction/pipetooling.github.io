SET lock_timeout = '3s';

-- Plan sets by part, punch list #272 (v2.6604): a crew member reads the plan part the job they are on builds from.
--
-- The read gate plan_part_can_see (20261101210000) opened a part two ways, both under the caller's own RLS: a
-- development's part through its developments row, which developments_select shows the office, estimators, primaries,
-- superintendents and a master's shares and never a crew; and a job's own part through on_site_can_touch_job, the
-- job in the ledger or on its team. A job outside any development owns its part, and the ledger shows the crew their
-- jobs, so that way was open; a job on a development builds from a part the development owns, and no crew member
-- read the development, so a subcontractor or a helper on such a job read no part, no set, and the job window's Add
-- our as-built (v2.6298, v2.6345) found nothing to add to. The bed plan_sets_author found it on 2026-11-06 (v2.6583).
--
-- This migration adds a third way: a SECURITY DEFINER read, row security off, of the caller's own crew jobs naming
-- the part — the same shape as helper_on_job (20261014220000) and plan_set_crew_on_job (20261106180000). The part
-- select policy reads the row's own columns (a policy that calls plan_part_can_see on its own table recurses), so it
-- gains the branch inline through the same helper. developments_select is not widened: the Development page and its
-- money read through it. plan_part_can_write starts from plan_part_can_see and adds the five office roles, so the
-- crew still writes nothing but their own as-builts and papers.

-- The caller is on the crew of a job that builds from the part: helper_on_job (the team table, or a schedule block
-- this week or last) on a job whose plan_part_id is the part, or that owns the part. Read as the definer with row
-- security off, since the team table's SELECT policy hides a helper's own crew row.
CREATE OR REPLACE FUNCTION public.plan_part_crew_can_see(p_part_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p_part_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.plan_parts p
    JOIN public.jobs_ledger j ON j.plan_part_id = p.id OR j.id = p.job_id
    WHERE p.id = p_part_id AND public.helper_on_job(j.id)
  )
$$;
COMMENT ON FUNCTION public.plan_part_crew_can_see(uuid) IS 'Plan sets by part (#272): the signed-in user is on the crew (helper_on_job) of a job that builds from the part or owns it. SECURITY DEFINER + row_security off, since the team table hides a helper''s own crew row.';
REVOKE EXECUTE ON FUNCTION public.plan_part_crew_can_see(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_part_crew_can_see(uuid) TO authenticated, service_role;

-- The read gate, from 20261101210000, with the crew's branch.
CREATE OR REPLACE FUNCTION public.plan_part_can_see(p_part_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.plan_parts p
    WHERE p.id = p_part_id
      AND (
        (p.development_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = p.development_id))
        OR (p.job_id IS NOT NULL AND public.on_site_can_touch_job(p.job_id))
        OR public.plan_part_crew_can_see(p.id)
      )
  )
$$;
COMMENT ON FUNCTION public.plan_part_can_see(uuid) IS 'Plan sets by part (#239, #272): the caller can see the part''s owner — the development row, or the job in the ledger or on its team — or is on the crew of a job that builds from the part (plan_part_crew_can_see).';
GRANT EXECUTE ON FUNCTION public.plan_part_can_see(uuid) TO authenticated, service_role;

-- The part's select policy, from 20261101210000, reads the row's own columns; the crew's branch through the definer,
-- which reads plan_parts with row security off and so does not recurse into this policy.
DROP POLICY IF EXISTS plan_parts_select ON public.plan_parts;
CREATE POLICY plan_parts_select ON public.plan_parts
  FOR SELECT TO authenticated USING (
    (development_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.developments d WHERE d.id = plan_parts.development_id))
    OR (job_id IS NOT NULL AND public.on_site_can_touch_job(plan_parts.job_id))
    OR public.plan_part_crew_can_see(id)
  );
