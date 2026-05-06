-- Remove percent-allocation revenue mode from bid pricing (keep omit_from_submission_documents).
UPDATE public.bid_pricing_assignments
SET revenue_allocated_by_pct = false,
    revenue_alloc_pct = NULL
WHERE revenue_allocated_by_pct = true
   OR revenue_alloc_pct IS NOT NULL;

ALTER TABLE public.bid_pricing_assignments
  DROP COLUMN IF EXISTS revenue_alloc_pct,
  DROP COLUMN IF EXISTS revenue_allocated_by_pct;
