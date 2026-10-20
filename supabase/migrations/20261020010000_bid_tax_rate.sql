-- Punch list #128, PR 1: the sales tax rate lives on the bid.
--
-- Until now the rate was a box on the Takeoffs tab held in React state, 8.25 on every reload
-- and never saved, applied to a row's takeoff material but left out of the bid's cost total.
-- The rate varies by city, so a bid keeps its own; the company default sits in app_settings
-- beside the schedule-of-values factor. Idempotent; no table is created.
SET lock_timeout = '3s';

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS tax_rate_pct numeric(6,3) NULL;

ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_tax_rate_pct_range;
ALTER TABLE public.bids
  ADD CONSTRAINT bids_tax_rate_pct_range CHECK (tax_rate_pct IS NULL OR (tax_rate_pct >= 0 AND tax_rate_pct <= 100));

COMMENT ON COLUMN public.bids.tax_rate_pct IS
  'The sales tax rate this bid taxes material at, percent (8.25 = 8.25%). NULL = the company default (app_settings bid_tax_rate_pct_v1).';

-- The company default: 8.25, the Takeoffs box''s old constant.
INSERT INTO public.app_settings (key, value_num)
VALUES ('bid_tax_rate_pct_v1', 8.25)
ON CONFLICT (key) DO NOTHING;
