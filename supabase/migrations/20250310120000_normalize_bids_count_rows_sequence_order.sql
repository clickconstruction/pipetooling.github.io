-- Normalize sequence_order for bids_count_rows: ensure each row has unique value (0,1,2,...) per bid.
-- Fixes non-deterministic ORDER BY when duplicate sequence_order exists.
DO $$
DECLARE
  r RECORD;
  seq_val INT := 0;
  current_bid_id UUID := NULL;
BEGIN
  FOR r IN (
    SELECT id, bid_id
    FROM public.bids_count_rows
    ORDER BY bid_id, sequence_order, id
  )
  LOOP
    IF current_bid_id IS NULL OR r.bid_id != current_bid_id THEN
      current_bid_id := r.bid_id;
      seq_val := 0;
    END IF;
    UPDATE public.bids_count_rows SET sequence_order = seq_val WHERE id = r.id;
    seq_val := seq_val + 1;
  END LOOP;
END $$;

COMMENT ON COLUMN public.bids_count_rows.sequence_order IS 'Per-bid ordering (0,1,2,...); must be unique per bid for deterministic sort.';
