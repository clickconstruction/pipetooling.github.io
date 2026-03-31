-- Create workflow_projections table for project cost projections
-- These are only visible to owners and master_technicians

CREATE TABLE IF NOT EXISTS public.workflow_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.project_workflows(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  memo TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflow_projections_workflow_id ON public.workflow_projections(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_projections_sequence_order ON public.workflow_projections(workflow_id, sequence_order);

-- Enable RLS
ALTER TABLE public.workflow_projections ENABLE ROW LEVEL SECURITY;

-- Policy: Only owners and master_technicians can read projections
CREATE POLICY "Owners and masters can read projections"
ON public.workflow_projections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Only owners and master_technicians can insert projections
CREATE POLICY "Owners and masters can insert projections"
ON public.workflow_projections
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Only owners and master_technicians can update projections
CREATE POLICY "Owners and masters can update projections"
ON public.workflow_projections
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Policy: Only owners and master_technicians can delete projections
CREATE POLICY "Owners and masters can delete projections"
ON public.workflow_projections
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('dev', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.workflow_projections IS 'Project cost projections for workflows, visible only to owners and master_technicians. Each projection has a stage name, memo, and amount.';
