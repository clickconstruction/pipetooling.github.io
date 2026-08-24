SET lock_timeout = '3s';

-- v2.2214 — per-GC bid notes (Bid Board GC lines → clickable names).
-- A bid note can now be about ONE GC on the bid: nullable gc_customer_id
-- (customers.id — the added/"Also sent to" GCs; the bid's own GC keeps using
-- whole-bid notes, i.e. NULL, which is also what every existing note means).
-- Additive + idempotent; existing RLS policies cover the new column.

ALTER TABLE public.bids_submission_entries ADD COLUMN IF NOT EXISTS gc_customer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bids_submission_entries_gc_customer_id_fkey'
      AND conrelid = 'public.bids_submission_entries'::regclass
  ) THEN
    ALTER TABLE public.bids_submission_entries
      ADD CONSTRAINT bids_submission_entries_gc_customer_id_fkey
      FOREIGN KEY (gc_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_bids_submission_entries_bid_gc
  ON public.bids_submission_entries (bid_id, gc_customer_id);

COMMENT ON COLUMN public.bids_submission_entries.gc_customer_id IS
  'The one GC this note is about (customers.id), for bids sent to several GCs. NULL = a whole-bid note (all pre-existing notes).';
