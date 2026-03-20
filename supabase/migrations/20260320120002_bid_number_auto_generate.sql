-- Bid number auto-generation: sequence, backfill, trigger
-- Global sequence; oldest bids get lowest numbers; new bids get next number when bid_number is null/empty

-- 1. Create sequence for auto-generation
CREATE SEQUENCE IF NOT EXISTS public.bids_bid_number_seq START 1;

-- 2. Backfill existing bids (oldest first)
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
  FROM public.bids
  WHERE bid_number IS NULL OR trim(bid_number) = ''
)
UPDATE public.bids b
SET bid_number = n.rn::TEXT
FROM numbered n
WHERE b.id = n.id;

-- 3. Set sequence to max(bid_number)+1
SELECT setval(
  'public.bids_bid_number_seq',
  COALESCE((
    SELECT MAX(CAST(NULLIF(trim(bid_number), '') AS INTEGER))
    FROM public.bids
    WHERE bid_number ~ '^\s*\d+\s*$'
  ), 0) + 1
);

-- 4. Trigger: auto-fill bid_number when null/empty on INSERT
CREATE OR REPLACE FUNCTION public.set_bid_number_if_empty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.bid_number IS NULL OR trim(COALESCE(NEW.bid_number, '')) = '' THEN
    NEW.bid_number := nextval('public.bids_bid_number_seq')::TEXT;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bids_set_bid_number ON public.bids;
CREATE TRIGGER bids_set_bid_number
  BEFORE INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bid_number_if_empty();

COMMENT ON SEQUENCE public.bids_bid_number_seq IS 'Auto-increment for bid_number when not provided.';
COMMENT ON FUNCTION public.set_bid_number_if_empty() IS 'Sets bid_number to next sequence value when null/empty on insert.';
