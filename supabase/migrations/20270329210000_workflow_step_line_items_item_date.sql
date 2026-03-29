-- Optional user-entered date for workflow step line items
ALTER TABLE public.workflow_step_line_items
  ADD COLUMN item_date date NULL;

COMMENT ON COLUMN public.workflow_step_line_items.item_date IS
  'Optional user-entered date for the line item (e.g. service or billing date).';
