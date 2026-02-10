-- Finalize fixture type migration by making fixture_type_id NOT NULL
-- and dropping old text columns (fixture_type, fixture, fixture_name)

-- ============================================================================
-- Make fixture_type_id columns NOT NULL
-- ============================================================================

-- Material parts
ALTER TABLE public.material_parts
ALTER COLUMN fixture_type_id SET NOT NULL;

-- Bids count rows
ALTER TABLE public.bids_count_rows
ALTER COLUMN fixture_type_id SET NOT NULL;

-- Labor book entries
ALTER TABLE public.labor_book_entries
ALTER COLUMN fixture_type_id SET NOT NULL;

-- Price book entries
ALTER TABLE public.price_book_entries
ALTER COLUMN fixture_type_id SET NOT NULL;

-- ============================================================================
-- Drop old text columns (migration complete)
-- ============================================================================

-- Drop material_parts.fixture_type (replaced by fixture_type_id FK)
ALTER TABLE public.material_parts
DROP COLUMN IF EXISTS fixture_type;

-- Drop bids_count_rows.fixture (replaced by fixture_type_id FK)
ALTER TABLE public.bids_count_rows
DROP COLUMN IF EXISTS fixture;

-- Drop labor_book_entries.fixture_name (replaced by fixture_type_id FK)
ALTER TABLE public.labor_book_entries
DROP COLUMN IF EXISTS fixture_name;

-- Drop price_book_entries.fixture_name (replaced by fixture_type_id FK)
ALTER TABLE public.price_book_entries
DROP COLUMN IF EXISTS fixture_name;

-- ============================================================================
-- Drop old indexes on removed columns
-- ============================================================================

-- These indexes were created on the old text columns and are no longer needed
DROP INDEX IF EXISTS public.idx_material_parts_fixture_type;
DROP INDEX IF EXISTS public.idx_labor_book_entries_fixture_name;
DROP INDEX IF EXISTS public.idx_price_book_entries_fixture_name;

-- Add final comments
COMMENT ON COLUMN public.material_parts.fixture_type_id IS 'Foreign key to fixture_types table - fixtures are now service-type-specific';
COMMENT ON COLUMN public.bids_count_rows.fixture_type_id IS 'Foreign key to fixture_types table - fixtures are now service-type-specific';
COMMENT ON COLUMN public.labor_book_entries.fixture_type_id IS 'Foreign key to fixture_types table - fixtures are now service-type-specific';
COMMENT ON COLUMN public.price_book_entries.fixture_type_id IS 'Foreign key to fixture_types table - fixtures are now service-type-specific';
