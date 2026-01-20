-- Add fields to track when a step was reopened due to next step rejection
-- This allows displaying "(next card rejected)" notice and rejection reason on the step card

ALTER TABLE public.project_workflow_steps 
ADD COLUMN IF NOT EXISTS next_step_rejected_notice TEXT NULL;

ALTER TABLE public.project_workflow_steps 
ADD COLUMN IF NOT EXISTS next_step_rejection_reason TEXT NULL;

COMMENT ON COLUMN public.project_workflow_steps.next_step_rejected_notice IS 'Stores the name of the next step that was rejected, causing this step to be reopened. Displayed as "(next card rejected)" notice.';
COMMENT ON COLUMN public.project_workflow_steps.next_step_rejection_reason IS 'Stores the rejection reason from the next step that was rejected. Displayed on dashboard and workflow pages.';
