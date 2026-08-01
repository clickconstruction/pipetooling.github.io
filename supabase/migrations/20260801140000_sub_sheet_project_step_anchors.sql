SET lock_timeout = '3s';

-- RUN_SUBS_PLAN Phase 0, PR 0.3: project/step anchors on sub sheets.
--
-- people_labor_jobs (the Sub Labor ledger) is keyed to a job only by the
-- job_number HCP string — it knows nothing about projects or workflow steps.
-- These nullable anchors let a sub sheet point at the step that earned it:
-- Phase 2's commitment settlement writes them, and Phase 1+ read paths show
-- the project chip. Purely additive; nothing writes them yet.
--
-- ON DELETE SET NULL on both: deleting a project or step un-anchors, never
-- deletes, the money record (mirrors workflow_projections.step_id, v2.1194).

ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS step_id uuid REFERENCES public.project_workflow_steps(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.people_labor_jobs.project_id IS
  'Optional anchor: the project this sub sheet belongs to. Settlement of a step commitment sets it (RUN_SUBS_PLAN Phase 2); the HCP job_number string remains the legacy job link.';

COMMENT ON COLUMN public.people_labor_jobs.step_id IS
  'Optional anchor: the workflow step this sub sheet pays for. SET NULL on step delete — the money record outlives the step.';

CREATE INDEX IF NOT EXISTS idx_people_labor_jobs_project_id
  ON public.people_labor_jobs (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_labor_jobs_step_id
  ON public.people_labor_jobs (step_id)
  WHERE step_id IS NOT NULL;
