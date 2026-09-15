SET lock_timeout = '3s';

-- Submittals, stage 1 PR 1c (to-dos/submittals/README.md): the estimator's
-- override of the derived product status on a picked quote line. The compare
-- derives as-specified / alternate / missing from the model numbers alone;
-- "superseded" (the maker replaced the model), "equal" (the schedule's own
-- "or equal" admits it) and "design change" (a differing performance value)
-- are facts only a person knows, so they are set from the status chip and
-- ride the picked line beside alternate_reason_kind / lead_time_days.

ALTER TABLE public.bid_quote_lines
  ADD COLUMN IF NOT EXISTS product_status_override text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_quote_lines_product_status_override_check') THEN
    ALTER TABLE public.bid_quote_lines
      ADD CONSTRAINT bid_quote_lines_product_status_override_check
      CHECK (product_status_override IS NULL OR product_status_override IN ('superseded', 'equal', 'design_change'));
  END IF;
END $$;

COMMENT ON COLUMN public.bid_quote_lines.product_status_override IS
  'Submittals stage 1c: the estimator''s override of the derived specified-vs-submitted status — superseded · equal · design_change; null = derived from the model numbers.';
