-- Add source_template_id to purchase_order_items so we can tag items added from a template

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS source_template_id UUID NULL REFERENCES public.material_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_source_template_id ON public.purchase_order_items(source_template_id);

COMMENT ON COLUMN public.purchase_order_items.source_template_id IS 'Template this line was added from (null if added manually or from Bids Takeoff).';
