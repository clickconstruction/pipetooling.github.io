-- Revert bids_count_rows back to free text (not FK)
-- Count rows should be flexible field notes, not restricted to fixture_types

-- Add back the fixture text column
ALTER TABLE public.bids_count_rows
ADD COLUMN IF NOT EXISTS fixture TEXT;

-- Backfill fixture text from joined fixture_types.name
UPDATE public.bids_count_rows bcr
SET fixture = ft.name
FROM public.fixture_types ft
WHERE bcr.fixture_type_id = ft.id
  AND bcr.fixture IS NULL;

-- Make fixture NOT NULL and set a default for any remaining nulls
UPDATE public.bids_count_rows
SET fixture = 'Unknown'
WHERE fixture IS NULL OR fixture = '';

ALTER TABLE public.bids_count_rows
ALTER COLUMN fixture SET NOT NULL;

-- Make fixture_type_id nullable (optional reference)
ALTER TABLE public.bids_count_rows
ALTER COLUMN fixture_type_id DROP NOT NULL;

-- Drop the FK constraint (count rows don't need strict references)
ALTER TABLE public.bids_count_rows
DROP CONSTRAINT IF EXISTS bids_count_rows_fixture_type_id_fkey;

-- Drop the column entirely (we're using text now)
ALTER TABLE public.bids_count_rows
DROP COLUMN IF EXISTS fixture_type_id;

-- Drop the index
DROP INDEX IF EXISTS public.idx_bids_count_rows_fixture_type_id;

-- Update comment
COMMENT ON COLUMN public.bids_count_rows.fixture IS 'Free text fixture name for flexible field notes (not restricted to fixture_types)';
