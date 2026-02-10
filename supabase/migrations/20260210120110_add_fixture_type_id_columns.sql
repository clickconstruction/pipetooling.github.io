-- Add fixture_type_id foreign key columns to material_parts, bids_count_rows, 
-- labor_book_entries, and price_book_entries
-- Keep old text columns temporarily for migration safety

-- ============================================================================
-- Add fixture_type_id columns (NULLABLE initially for safe migration)
-- ============================================================================

-- Add to material_parts (keep old fixture_type)
ALTER TABLE public.material_parts
ADD COLUMN IF NOT EXISTS fixture_type_id UUID REFERENCES public.fixture_types(id);

-- Add to bids_count_rows (keep old fixture)
ALTER TABLE public.bids_count_rows
ADD COLUMN IF NOT EXISTS fixture_type_id UUID REFERENCES public.fixture_types(id);

-- Add to labor_book_entries (keep old fixture_name)
ALTER TABLE public.labor_book_entries
ADD COLUMN IF NOT EXISTS fixture_type_id UUID REFERENCES public.fixture_types(id);

-- Add to price_book_entries (keep old fixture_name)
ALTER TABLE public.price_book_entries
ADD COLUMN IF NOT EXISTS fixture_type_id UUID REFERENCES public.fixture_types(id);

-- ============================================================================
-- Backfill fixture_type_id values from text columns
-- ============================================================================

DO $$
DECLARE
  plumbing_id UUID;
BEGIN
  SELECT id INTO plumbing_id FROM public.service_types WHERE name = 'Plumbing' LIMIT 1;
  
  -- ========================================================================
  -- Backfill material_parts.fixture_type_id
  -- ========================================================================
  
  -- Match existing fixture_type text to fixture_types records
  UPDATE public.material_parts mp
  SET fixture_type_id = ft.id
  FROM public.fixture_types ft
  WHERE ft.service_type_id = plumbing_id
    AND ft.name = mp.fixture_type
    AND mp.fixture_type_id IS NULL
    AND mp.fixture_type IS NOT NULL;
  
  -- For any unmatched non-null fixture_type values, create "Other" entry if needed
  -- and assign to it
  WITH unmatched AS (
    SELECT DISTINCT fixture_type
    FROM public.material_parts
    WHERE fixture_type IS NOT NULL
      AND fixture_type_id IS NULL
      AND fixture_type != ''
  ),
  other_fixture AS (
    SELECT id FROM public.fixture_types
    WHERE service_type_id = plumbing_id AND name = 'Other'
    LIMIT 1
  )
  UPDATE public.material_parts mp
  SET fixture_type_id = (SELECT id FROM other_fixture)
  WHERE mp.fixture_type IS NOT NULL
    AND mp.fixture_type != ''
    AND mp.fixture_type_id IS NULL
    AND EXISTS (SELECT 1 FROM other_fixture);
  
  -- ========================================================================
  -- Backfill bids_count_rows.fixture_type_id
  -- ========================================================================
  
  -- Match existing fixture text to fixture_types records
  UPDATE public.bids_count_rows bcr
  SET fixture_type_id = ft.id
  FROM public.fixture_types ft
  WHERE ft.service_type_id = plumbing_id
    AND ft.name = bcr.fixture
    AND bcr.fixture_type_id IS NULL
    AND bcr.fixture IS NOT NULL;
  
  -- For any unmatched fixture values, try to create fixture_type entries
  WITH unmatched_fixtures AS (
    SELECT DISTINCT fixture
    FROM public.bids_count_rows
    WHERE fixture IS NOT NULL
      AND fixture != ''
      AND fixture_type_id IS NULL
  ),
  new_fixtures AS (
    INSERT INTO public.fixture_types (service_type_id, name, category, sequence_order)
    SELECT 
      plumbing_id,
      uf.fixture,
      'Other',
      (SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM public.fixture_types WHERE service_type_id = plumbing_id)
    FROM unmatched_fixtures uf
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fixture_types ft2
      WHERE ft2.service_type_id = plumbing_id AND ft2.name = uf.fixture
    )
    ON CONFLICT (service_type_id, name) DO NOTHING
    RETURNING id, name
  )
  UPDATE public.bids_count_rows bcr
  SET fixture_type_id = nf.id
  FROM new_fixtures nf
  WHERE bcr.fixture = nf.name
    AND bcr.fixture_type_id IS NULL;
  
  -- Second pass to catch any that were already in the table
  UPDATE public.bids_count_rows bcr
  SET fixture_type_id = ft.id
  FROM public.fixture_types ft
  WHERE ft.service_type_id = plumbing_id
    AND ft.name = bcr.fixture
    AND bcr.fixture_type_id IS NULL
    AND bcr.fixture IS NOT NULL;
  
  -- ========================================================================
  -- Backfill labor_book_entries.fixture_type_id
  -- ========================================================================
  
  -- Match existing fixture_name text to fixture_types records
  UPDATE public.labor_book_entries lbe
  SET fixture_type_id = ft.id
  FROM public.fixture_types ft
  WHERE ft.service_type_id = plumbing_id
    AND ft.name = lbe.fixture_name
    AND lbe.fixture_type_id IS NULL
    AND lbe.fixture_name IS NOT NULL;
  
  -- For any unmatched fixture_name values, create fixture_type entries
  WITH unmatched_labor AS (
    SELECT DISTINCT fixture_name
    FROM public.labor_book_entries
    WHERE fixture_name IS NOT NULL
      AND fixture_name != ''
      AND fixture_type_id IS NULL
  ),
  new_labor_fixtures AS (
    INSERT INTO public.fixture_types (service_type_id, name, category, sequence_order)
    SELECT 
      plumbing_id,
      ul.fixture_name,
      'Labor',
      (SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM public.fixture_types WHERE service_type_id = plumbing_id)
    FROM unmatched_labor ul
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fixture_types ft2
      WHERE ft2.service_type_id = plumbing_id AND ft2.name = ul.fixture_name
    )
    ON CONFLICT (service_type_id, name) DO NOTHING
    RETURNING id, name
  )
  UPDATE public.labor_book_entries lbe
  SET fixture_type_id = nlf.id
  FROM new_labor_fixtures nlf
  WHERE lbe.fixture_name = nlf.name
    AND lbe.fixture_type_id IS NULL;
  
  -- Second pass for labor book entries
  UPDATE public.labor_book_entries lbe
  SET fixture_type_id = ft.id
  FROM public.fixture_types ft
  WHERE ft.service_type_id = plumbing_id
    AND ft.name = lbe.fixture_name
    AND lbe.fixture_type_id IS NULL
    AND lbe.fixture_name IS NOT NULL;
  
  -- ========================================================================
  -- Backfill price_book_entries.fixture_type_id
  -- ========================================================================
  
  -- Match existing fixture_name text to fixture_types records
  UPDATE public.price_book_entries pbe
  SET fixture_type_id = ft.id
  FROM public.fixture_types ft
  WHERE ft.service_type_id = plumbing_id
    AND ft.name = pbe.fixture_name
    AND pbe.fixture_type_id IS NULL
    AND pbe.fixture_name IS NOT NULL;
  
  -- For any unmatched fixture_name values, create fixture_type entries
  WITH unmatched_price AS (
    SELECT DISTINCT fixture_name
    FROM public.price_book_entries
    WHERE fixture_name IS NOT NULL
      AND fixture_name != ''
      AND fixture_type_id IS NULL
  ),
  new_price_fixtures AS (
    INSERT INTO public.fixture_types (service_type_id, name, category, sequence_order)
    SELECT 
      plumbing_id,
      up.fixture_name,
      'Pricing',
      (SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM public.fixture_types WHERE service_type_id = plumbing_id)
    FROM unmatched_price up
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fixture_types ft2
      WHERE ft2.service_type_id = plumbing_id AND ft2.name = up.fixture_name
    )
    ON CONFLICT (service_type_id, name) DO NOTHING
    RETURNING id, name
  )
  UPDATE public.price_book_entries pbe
  SET fixture_type_id = npf.id
  FROM new_price_fixtures npf
  WHERE pbe.fixture_name = npf.name
    AND pbe.fixture_type_id IS NULL;
  
  -- Second pass for price book entries
  UPDATE public.price_book_entries pbe
  SET fixture_type_id = ft.id
  FROM public.fixture_types ft
  WHERE ft.service_type_id = plumbing_id
    AND ft.name = pbe.fixture_name
    AND pbe.fixture_type_id IS NULL
    AND pbe.fixture_name IS NOT NULL;
  
END $$;

-- ============================================================================
-- Add indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_material_parts_fixture_type_id 
  ON public.material_parts(fixture_type_id);

CREATE INDEX IF NOT EXISTS idx_bids_count_rows_fixture_type_id 
  ON public.bids_count_rows(fixture_type_id);

CREATE INDEX IF NOT EXISTS idx_labor_book_entries_fixture_type_id 
  ON public.labor_book_entries(fixture_type_id);

CREATE INDEX IF NOT EXISTS idx_price_book_entries_fixture_type_id 
  ON public.price_book_entries(fixture_type_id);

-- Add comments
COMMENT ON COLUMN public.material_parts.fixture_type_id IS 'Foreign key to fixture_types table (service-type-specific)';
COMMENT ON COLUMN public.bids_count_rows.fixture_type_id IS 'Foreign key to fixture_types table (service-type-specific)';
COMMENT ON COLUMN public.labor_book_entries.fixture_type_id IS 'Foreign key to fixture_types table (service-type-specific)';
COMMENT ON COLUMN public.price_book_entries.fixture_type_id IS 'Foreign key to fixture_types table (service-type-specific)';
