-- Optional 0-100 progress estimate for each workflow step.
-- Editable from the Forecast Specific gutter ("%" column) and the Workflow
-- expanded stage card. NULL when the team doesn't track a numeric estimate
-- for that stage (the default).
--
-- Append-only per AGENTS.md Critical Constraint 1; nullable + DEFAULT NULL so
-- backfill is implicit and no existing rows need rewriting. The CHECK keeps
-- ad-hoc SQL writers honest if they ever bypass the parsePercentCompleteInput
-- helper that the UI uses.

ALTER TABLE public.project_workflow_steps
  ADD COLUMN IF NOT EXISTS percent_complete INTEGER NULL
    CHECK (percent_complete IS NULL OR (percent_complete BETWEEN 0 AND 100));

COMMENT ON COLUMN public.project_workflow_steps.percent_complete IS
  'Optional 0-100 progress estimate for the stage. NULL when not tracked.';
