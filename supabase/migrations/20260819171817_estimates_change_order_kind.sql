SET lock_timeout = '3s';

-- Change orders ride the estimates rails (v2.1826 — CO train PR 1).
-- A change order becomes a KIND of estimate instead of a new system: it
-- inherits the whole acceptance machine (public token accept page, typed
-- signature capture, send email, accepted-notify, status pipeline) for free.
--   doc_kind            'estimate' (default; every existing row) | 'change_order'
--   change_order_fields CO narrative (description of change, reason, schedule
--                       impact, response-by date, checklists) — jsonb, client-owned
--   bid_id              the bid a CO modifies (the Bids → Estimates bridge,
--                       CO train PR 6); nullable, jobs/estimates keep using
--                       the existing job_ledger_id / project_id links
-- Additive only; existing RLS on estimates covers the new columns.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS doc_kind text NOT NULL DEFAULT 'estimate';

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS change_order_fields jsonb;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.estimates'::regclass
      AND conname = 'estimates_doc_kind_check'
  ) THEN
    ALTER TABLE public.estimates
      ADD CONSTRAINT estimates_doc_kind_check
      CHECK (doc_kind IN ('estimate', 'change_order'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS estimates_bid_idx
  ON public.estimates (bid_id)
  WHERE bid_id IS NOT NULL;
