-- Allow one assignment per (bid, count row, price book version) so each version keeps its own mapping.

-- 1. Add column (nullable for backfill)
ALTER TABLE public.bid_pricing_assignments
  ADD COLUMN IF NOT EXISTS price_book_version_id UUID REFERENCES public.price_book_versions(id) ON DELETE CASCADE;

-- 2. Backfill from the entry's version
UPDATE public.bid_pricing_assignments a
SET price_book_version_id = e.version_id
FROM public.price_book_entries e
WHERE e.id = a.price_book_entry_id
  AND a.price_book_version_id IS NULL;

-- 3. Remove any rows that could not be backfilled (orphaned entry)
DELETE FROM public.bid_pricing_assignments
WHERE price_book_version_id IS NULL;

-- 4. Set NOT NULL
ALTER TABLE public.bid_pricing_assignments
  ALTER COLUMN price_book_version_id SET NOT NULL;

-- 5. Drop old unique constraint (Postgres default name)
ALTER TABLE public.bid_pricing_assignments
  DROP CONSTRAINT IF EXISTS bid_pricing_assignments_bid_id_count_row_id_key;

-- 6. Add new unique constraint
ALTER TABLE public.bid_pricing_assignments
  ADD CONSTRAINT bid_pricing_assignments_bid_id_count_row_id_version_key
  UNIQUE (bid_id, count_row_id, price_book_version_id);

-- 7. Index for filter by version
CREATE INDEX IF NOT EXISTS idx_bid_pricing_assignments_price_book_version_id
  ON public.bid_pricing_assignments(price_book_version_id);

COMMENT ON COLUMN public.bid_pricing_assignments.price_book_version_id IS 'Price book version this assignment applies to; one assignment per (bid, count row, version).';
