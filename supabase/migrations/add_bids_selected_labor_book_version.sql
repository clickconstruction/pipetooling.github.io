-- Persist selected labor book version per bid on Cost Estimate tab.
-- Run after create_labor_book_versions_and_entries.sql.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS selected_labor_book_version_id UUID REFERENCES public.labor_book_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bids_selected_labor_book_version_id ON public.bids(selected_labor_book_version_id);

COMMENT ON COLUMN public.bids.selected_labor_book_version_id IS 'Labor book version used for this bid on Cost Estimate tab (prefill for new labor rows).';
