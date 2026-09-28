SET lock_timeout = '3s';

-- Cover Letter → Schedule of values pill (v2.4058): the letter spreads the bid
-- amount across Rough In / Top Out / Trim Set by the takeoff's stage shares.
-- The pill remembers per bid, like include_payment_schedule and
-- include_materials_by_stage. Additive; the old client ignores the column.
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS include_schedule_of_values boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bids.include_schedule_of_values IS
  'Cover Letter: carry a Schedule of values section (the bid amount by stage, from the takeoff''s stage shares) in the letter and the Approval PDF.';
