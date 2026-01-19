-- Add master_user_id to projects table
-- This tracks which master "owns" each project
-- Assistants can create projects and assign them to masters who have adopted them

-- Add column (nullable initially for existing projects)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS master_user_id UUID REFERENCES public.users(id);

-- Backfill existing projects: Set master_user_id based on customer's master_user_id
UPDATE public.projects p
SET master_user_id = c.master_user_id
FROM public.customers c
WHERE p.customer_id = c.id
AND p.master_user_id IS NULL;

-- Make column NOT NULL for new projects (after backfill)
-- Note: We'll keep it nullable in the schema but enforce in application logic
-- This allows for edge cases during migration

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_master_user_id ON public.projects(master_user_id);

-- Add comment
COMMENT ON COLUMN public.projects.master_user_id IS 'The master technician who owns this project. Assistants can create projects and assign them to masters who have adopted them.';
