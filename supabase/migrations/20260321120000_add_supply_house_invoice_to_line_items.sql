-- Add supply_house_invoice_id column to workflow_step_line_items table

ALTER TABLE public.workflow_step_line_items
ADD COLUMN IF NOT EXISTS supply_house_invoice_id UUID REFERENCES public.supply_house_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_step_line_items_supply_house_invoice_id
ON public.workflow_step_line_items(supply_house_invoice_id);

COMMENT ON COLUMN public.workflow_step_line_items.supply_house_invoice_id IS
'Optional link to supply house invoice. When set, this line item was added from Materials Supply Houses.';
