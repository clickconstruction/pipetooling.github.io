-- Persist selected price book version per bid on Pricing tab.
-- Run after create_price_book_versions_and_entries.sql.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS selected_price_book_version_id UUID REFERENCES public.price_book_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bids_selected_price_book_version_id ON public.bids(selected_price_book_version_id);

COMMENT ON COLUMN public.bids.selected_price_book_version_id IS 'Price book version used for this bid on Pricing tab.';
