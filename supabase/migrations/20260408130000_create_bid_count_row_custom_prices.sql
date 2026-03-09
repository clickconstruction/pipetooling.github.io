-- Custom unit prices for count rows when no price book entry is assigned (Price Model)
CREATE TABLE IF NOT EXISTS public.bid_count_row_custom_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  count_row_id UUID NOT NULL REFERENCES public.bids_count_rows(id) ON DELETE CASCADE,
  price_book_version_id UUID NOT NULL REFERENCES public.price_book_versions(id) ON DELETE CASCADE,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bid_id, count_row_id, price_book_version_id)
);

CREATE INDEX IF NOT EXISTS idx_bid_count_row_custom_prices_bid_version ON public.bid_count_row_custom_prices(bid_id, price_book_version_id);

ALTER TABLE public.bid_count_row_custom_prices ENABLE ROW LEVEL SECURITY;

-- Same RLS as bid_pricing_assignments
CREATE POLICY "Bid pricing users can read custom prices"
ON public.bid_count_row_custom_prices FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator'))
  AND EXISTS (
    SELECT 1 FROM public.bids b WHERE b.id = bid_count_row_custom_prices.bid_id
    AND (b.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator')))
  )
);

CREATE POLICY "Bid pricing users can insert custom prices"
ON public.bid_count_row_custom_prices FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator'))
  AND EXISTS (
    SELECT 1 FROM public.bids b WHERE b.id = bid_count_row_custom_prices.bid_id
    AND (b.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator')))
  )
);

CREATE POLICY "Bid pricing users can update custom prices"
ON public.bid_count_row_custom_prices FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator'))
  AND EXISTS (
    SELECT 1 FROM public.bids b WHERE b.id = bid_count_row_custom_prices.bid_id
    AND (b.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator')))
  )
);

CREATE POLICY "Bid pricing users can delete custom prices"
ON public.bid_count_row_custom_prices FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'estimator'))
  AND EXISTS (
    SELECT 1 FROM public.bids b WHERE b.id = bid_count_row_custom_prices.bid_id
    AND (b.created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'assistant', 'estimator')))
  )
);

COMMENT ON TABLE public.bid_count_row_custom_prices IS 'Custom unit prices when no price book entry is assigned. Used in Bids Pricing tab Price Model.';
