-- Drop the old fixture_type_id column from material_parts
-- Keep it on bids_count_rows, labor_book_entries, price_book_entries
-- Those tables correctly use fixture_types (installed fixtures, not parts)

-- ============================================================================
-- Drop old fixture_type_id from material_parts only
-- ============================================================================

-- Drop index first
DROP INDEX IF EXISTS public.idx_material_parts_fixture_type_id;

-- Drop column
ALTER TABLE public.material_parts
DROP COLUMN IF EXISTS fixture_type_id;
