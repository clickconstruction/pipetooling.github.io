SET lock_timeout = '3s';

-- v2.2844 — superintendents see and edit only the sub work orders on their own
-- jobs and projects. Follow-up to 20260905100000_project_access_assigned_superintendents
-- (v2.2836, PR #2575), which closed the project-level adoption leak.
--
-- Journey map drift sweep (_DRIFT-2 Tier-1 #4 / Flag 1): can_access_sub_work_order
-- (20260904211244:70-105, superseded by 20260905050035:73-95) grants every
-- `superintendent` — by role literal — SELECT on sheet- and job-anchored
-- step_commitments rows, and the sc_update policy (20260905050035:126,:133)
-- routes UPDATE through the same helper, so every superintendent could read and
-- edit every work order in the company that was not tied to a workflow step.
-- The function comment argued from "the Sub Labor tab audience", but that
-- audience is the office set: the people_labor_jobs SELECT policy is
-- dev/master_technician/assistant/estimator only, and Jobs.tsx hides the
-- Work Orders tab from superintendents (`showSuperintendentExtraTabs`).
--
-- Rule after this migration, for role = 'superintendent':
--   step-anchored  → can_access_project_via_step(step_id)         (unchanged; v2.2836 fixes adoption)
--   job-anchored   → superintendent_report_job_anchor_allowed(job_id)
--   sheet-anchored → the sheet's job under the same job anchor (job_id when the
--                    row carries one, else the sheet's project or the jobs_ledger
--                    row whose hcp_number matches the sheet's job_number)
-- superintendent_report_job_anchor_allowed is the sanctioned superintendent job
-- anchor already used by the reports RLS (v2.2599) and the job thread-notes
-- policies (v2.2647): strict project assignment (1-arg can_access_project_row →
-- project_superintendents only) OR jobs_ledger_team_members on the job.
--
-- Office roles (dev/master_technician/assistant/controller/estimator) and the
-- sub's own-row branches are byte-for-byte what they were. No policy text
-- changes: sc_select / sc_insert / sc_update / sc_delete all call
-- can_access_sub_work_order, so tightening the helper tightens every verb.
-- Idempotent (CREATE OR REPLACE only).

-- 1) The superintendent branch, as its own helper -----------------------------

CREATE OR REPLACE FUNCTION public.superintendent_can_access_sub_work_order(p_labor_job_id uuid, p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    -- job-anchored (or a sheet-anchored row that was back-filled with its job)
    (p_job_id IS NOT NULL AND public.superintendent_report_job_anchor_allowed(p_job_id))
    OR (
      -- sheet-anchored without a job_id: resolve the job through the sheet
      p_labor_job_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.people_labor_jobs s
        WHERE s.id = p_labor_job_id
          AND (
            (s.project_id IS NOT NULL AND public.can_access_project_row(s.project_id))
            OR (
              s.job_number IS NOT NULL AND btrim(s.job_number) <> ''
              AND EXISTS (
                SELECT 1 FROM public.jobs_ledger jl
                WHERE lower(btrim(jl.hcp_number)) = lower(btrim(s.job_number))
                  AND public.superintendent_report_job_anchor_allowed(jl.id)
              )
            )
          )
      )
    );
$$;

COMMENT ON FUNCTION public.superintendent_can_access_sub_work_order(uuid, uuid) IS
  'Superintendent branch of can_access_sub_work_order (v2.2844): a sheet- or job-anchored work order is theirs when its job passes superintendent_report_job_anchor_allowed (assigned project OR team member), resolving a sheet''s job via job_id, the sheet''s project, or its job_number. Does not check the caller''s role — the caller does. row_security off so the check does not depend on the caller''s people_labor_jobs / jobs_ledger visibility.';

REVOKE EXECUTE ON FUNCTION public.superintendent_can_access_sub_work_order(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superintendent_can_access_sub_work_order(uuid, uuid) TO authenticated;

-- 2) The access helper every step_commitments policy calls --------------------

CREATE OR REPLACE FUNCTION public.can_access_sub_work_order(p_step_id uuid, p_labor_job_id uuid, p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_step_id IS NOT NULL THEN public.can_access_project_via_step(p_step_id)
    WHEN p_labor_job_id IS NOT NULL OR p_job_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role IN ('dev','master_technician','assistant','controller','estimator')
          OR (
            u.role = 'superintendent'
            AND public.superintendent_can_access_sub_work_order(p_labor_job_id, p_job_id)
          )
        )
    )
    ELSE false
  END;
$$;

COMMENT ON FUNCTION public.can_access_sub_work_order(uuid, uuid, uuid) IS
  'Row access for step_commitments: step rows follow the project (can_access_project_via_step); sheet- and job-anchored rows are visible to the office set, and to superintendents only when the job is theirs (superintendent_can_access_sub_work_order, v2.2844). Called by sc_select / sc_insert / sc_update / sc_delete.';

REVOKE EXECUTE ON FUNCTION public.can_access_sub_work_order(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_sub_work_order(uuid, uuid, uuid) TO authenticated;
