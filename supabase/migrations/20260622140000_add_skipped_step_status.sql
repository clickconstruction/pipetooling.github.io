-- Add skipped status to workflow steps (stage not applicable for this project).
-- Skipped stages do not block progress; reason is required via UI.

ALTER TYPE public.step_status ADD VALUE IF NOT EXISTS 'skipped';

ALTER TABLE public.project_workflow_steps
ADD COLUMN IF NOT EXISTS skipped_reason TEXT NULL;

COMMENT ON COLUMN public.project_workflow_steps.skipped_reason IS 'Reason why this stage was skipped (required when marking as skipped). e.g. "Not relevant", "Client waived inspection".';
