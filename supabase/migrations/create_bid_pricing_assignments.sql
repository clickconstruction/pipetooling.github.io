-- Pricing tab: link bid count rows to price book entries for margin comparison.
-- Run after create_price_book_versions_and_entries.sql and add_bids_selected_price_book_version.sql.

CREATE TABLE IF NOT EXISTS public.bid_pricing_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  count_row_id UUID NOT NULL REFERENCES public.bids_count_rows(id) ON DELETE CASCADE,
  price_book_entry_id UUID NOT NULL REFERENCES public.price_book_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bid_id, count_row_id)
);

CREATE INDEX IF NOT EXISTS idx_bid_pricing_assignments_bid_id ON public.bid_pricing_assignments(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_pricing_assignments_count_row_id ON public.bid_pricing_assignments(count_row_id);
CREATE INDEX IF NOT EXISTS idx_bid_pricing_assignments_price_book_entry_id ON public.bid_pricing_assignments(price_book_entry_id);

ALTER TABLE public.bid_pricing_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs, masters, assistants, and estimators can read bid pricing assignments"
ON public.bid_pricing_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bid_pricing_assignments.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert bid pricing assignments"
ON public.bid_pricing_assignments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bid_pricing_assignments.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can update bid pricing assignments"
ON public.bid_pricing_assignments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bid_pricing_assignments.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete bid pricing assignments"
ON public.bid_pricing_assignments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = bid_pricing_assignments.bid_id
    AND (
      b.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'assistant', 'estimator')
      )
    )
  )
);

COMMENT ON TABLE public.bid_pricing_assignments IS 'Maps bid count rows to price book entries for margin comparison on Pricing tab.';
