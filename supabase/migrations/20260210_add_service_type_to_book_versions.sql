-- Add service_type_id to all book version tables
-- This makes books service-type-specific (Plumbing, Electrical, HVAC)

-- 1. Add nullable service_type_id columns
ALTER TABLE public.price_book_versions
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE;

ALTER TABLE public.labor_book_versions
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE;

ALTER TABLE public.takeoff_book_versions
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id) ON DELETE CASCADE;

-- 2. Migrate existing books to Plumbing service type
-- Get Plumbing service type ID
DO $$
DECLARE
  plumbing_id UUID;
BEGIN
  SELECT id INTO plumbing_id FROM public.service_types WHERE name = 'Plumbing';
  
  -- Update all existing book versions to Plumbing
  UPDATE public.price_book_versions SET service_type_id = plumbing_id WHERE service_type_id IS NULL;
  UPDATE public.labor_book_versions SET service_type_id = plumbing_id WHERE service_type_id IS NULL;
  UPDATE public.takeoff_book_versions SET service_type_id = plumbing_id WHERE service_type_id IS NULL;
END $$;

-- 3. Make service_type_id required
ALTER TABLE public.price_book_versions
ALTER COLUMN service_type_id SET NOT NULL;

ALTER TABLE public.labor_book_versions
ALTER COLUMN service_type_id SET NOT NULL;

ALTER TABLE public.takeoff_book_versions
ALTER COLUMN service_type_id SET NOT NULL;

-- 4. Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_price_book_versions_service_type_id 
ON public.price_book_versions(service_type_id);

CREATE INDEX IF NOT EXISTS idx_labor_book_versions_service_type_id 
ON public.labor_book_versions(service_type_id);

CREATE INDEX IF NOT EXISTS idx_takeoff_book_versions_service_type_id 
ON public.takeoff_book_versions(service_type_id);

-- 5. Add comments
COMMENT ON COLUMN public.price_book_versions.service_type_id IS 'Service type this price book belongs to (Plumbing, Electrical, HVAC)';
COMMENT ON COLUMN public.labor_book_versions.service_type_id IS 'Service type this labor book belongs to (Plumbing, Electrical, HVAC)';
COMMENT ON COLUMN public.takeoff_book_versions.service_type_id IS 'Service type this takeoff book belongs to (Plumbing, Electrical, HVAC)';
