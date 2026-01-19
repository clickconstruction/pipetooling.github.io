-- Create workflow_step_line_items table for private line items
-- These are only visible to owners and master_technicians

CREATE TABLE IF NOT EXISTS public.workflow_step_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.project_workflow_steps(id) ON DELETE CASCADE,
  memo TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflow_step_line_items_step_id ON public.workflow_step_line_items(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_line_items_sequence_order ON public.workflow_step_line_items(step_id, sequence_order);

-- Enable RLS
ALTER TABLE public.workflow_step_line_items ENABLE ROW LEVEL SECURITY;

-- Policy: Only owners and master_technicians can read line items
CREATE POLICY "Owners and masters can read line items"
ON public.workflow_step_line_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'master_technician')
  )
);

-- Policy: Only owners and master_technicians can insert line items
CREATE POLICY "Owners and masters can insert line items"
ON public.workflow_step_line_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'master_technician')
  )
);

-- Policy: Only owners and master_technicians can update line items
CREATE POLICY "Owners and masters can update line items"
ON public.workflow_step_line_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'master_technician')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'master_technician')
  )
);

-- Policy: Only owners and master_technicians can delete line items
CREATE POLICY "Owners and masters can delete line items"
ON public.workflow_step_line_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('owner', 'master_technician')
  )
);

-- Add comment
COMMENT ON TABLE public.workflow_step_line_items IS 'Private line items for workflow steps, visible only to owners and master_technicians. Each line item has a memo and amount.';
