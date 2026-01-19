-- Add private_notes field to project_workflow_steps table
-- This field is only visible to owners and master_technicians

ALTER TABLE public.project_workflow_steps
ADD COLUMN IF NOT EXISTS private_notes TEXT;

-- Add comment to document the field
COMMENT ON COLUMN public.project_workflow_steps.private_notes IS 'Private notes visible only to owners and master_technicians. Regular notes field is visible to all users.';
