-- Add link column to workflow_step_line_items table

ALTER TABLE public.workflow_step_line_items
ADD COLUMN IF NOT EXISTS link TEXT;

-- Add comment
COMMENT ON COLUMN public.workflow_step_line_items.link IS 'Optional link to external resources (e.g., Google Sheets with purchase orders, supply house part listings).';
