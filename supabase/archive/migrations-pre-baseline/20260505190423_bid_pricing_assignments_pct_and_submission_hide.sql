-- Pricing tab: percent-of-base revenue rows and omit from customer-facing fixture lists
ALTER TABLE public.bid_pricing_assignments
  ADD COLUMN IF NOT EXISTS revenue_allocated_by_pct boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revenue_alloc_pct numeric(10, 4),
  ADD COLUMN IF NOT EXISTS omit_from_submission_documents boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bid_pricing_assignments.revenue_allocated_by_pct IS 'When true, row revenue = (revenue_alloc_pct/100)*base where base is bid bid_value or sum of standard row revenues.';
COMMENT ON COLUMN public.bid_pricing_assignments.revenue_alloc_pct IS 'Percentage 0–100 applied to base when revenue_allocated_by_pct is true.';
COMMENT ON COLUMN public.bid_pricing_assignments.omit_from_submission_documents IS 'When true, row is omitted from customer-facing fixture lists (Cover Letter / Approval PDF pricing grid) but still in revenue totals.';
