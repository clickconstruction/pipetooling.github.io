-- Add purchase_order_id column to workflow_step_line_items table

ALTER TABLE public.workflow_step_line_items
ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflow_step_line_items_purchase_order_id ON public.workflow_step_line_items(purchase_order_id);

-- Add comment
COMMENT ON COLUMN public.workflow_step_line_items.purchase_order_id IS 'Optional link to a purchase order. When set, this line item represents a purchase order added to the workflow step.';
