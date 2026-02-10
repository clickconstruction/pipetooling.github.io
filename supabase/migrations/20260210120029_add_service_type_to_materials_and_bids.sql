-- Add service_type_id foreign key columns to material_parts, material_templates, purchase_orders, and bids
-- Backfill all existing records with the Plumbing service type

-- ============================================================================
-- Add service_type_id columns (NULLABLE initially for migration)
-- ============================================================================

-- Add to material_parts
ALTER TABLE public.material_parts
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);

-- Add to material_templates
ALTER TABLE public.material_templates
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);

-- Add to purchase_orders
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);

-- Add to bids
ALTER TABLE public.bids
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);

-- ============================================================================
-- Backfill with Plumbing service type
-- ============================================================================

-- Get the Plumbing service type ID
DO $$
DECLARE
  plumbing_id UUID;
BEGIN
  SELECT id INTO plumbing_id FROM public.service_types WHERE name = 'Plumbing' LIMIT 1;
  
  -- Backfill material_parts
  UPDATE public.material_parts
  SET service_type_id = plumbing_id
  WHERE service_type_id IS NULL;
  
  -- Backfill material_templates
  UPDATE public.material_templates
  SET service_type_id = plumbing_id
  WHERE service_type_id IS NULL;
  
  -- Backfill purchase_orders
  UPDATE public.purchase_orders
  SET service_type_id = plumbing_id
  WHERE service_type_id IS NULL;
  
  -- Backfill bids
  UPDATE public.bids
  SET service_type_id = plumbing_id
  WHERE service_type_id IS NULL;
END $$;

-- ============================================================================
-- Make columns NOT NULL and add indexes
-- ============================================================================

-- Make columns NOT NULL
ALTER TABLE public.material_parts
ALTER COLUMN service_type_id SET NOT NULL;

ALTER TABLE public.material_templates
ALTER COLUMN service_type_id SET NOT NULL;

ALTER TABLE public.purchase_orders
ALTER COLUMN service_type_id SET NOT NULL;

ALTER TABLE public.bids
ALTER COLUMN service_type_id SET NOT NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_material_parts_service_type_id 
  ON public.material_parts(service_type_id);

CREATE INDEX IF NOT EXISTS idx_material_templates_service_type_id 
  ON public.material_templates(service_type_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_service_type_id 
  ON public.purchase_orders(service_type_id);

CREATE INDEX IF NOT EXISTS idx_bids_service_type_id 
  ON public.bids(service_type_id);

-- Add comments
COMMENT ON COLUMN public.material_parts.service_type_id IS 'Foreign key to service_types table';
COMMENT ON COLUMN public.material_templates.service_type_id IS 'Foreign key to service_types table';
COMMENT ON COLUMN public.purchase_orders.service_type_id IS 'Foreign key to service_types table';
COMMENT ON COLUMN public.bids.service_type_id IS 'Foreign key to service_types table';
