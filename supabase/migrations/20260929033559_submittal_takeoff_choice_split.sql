SET lock_timeout = '3s';

-- v2.4114 · Splitting a combined count row (WC 1&2 → WC-1, WC-2) on the submittal: the estimator's
-- Split switch in Choose from the takeoff, remembered beside the tick so the next revision and
-- Add from the takeoff split the same way. Additive; the default keeps every row as counted.
ALTER TABLE public.bid_submittal_takeoff_choices ADD COLUMN IF NOT EXISTS split boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.bid_submittal_takeoff_choices.split IS 'v2.4114: one submittal row per tag read off the fixture name (WC 1&2 → WC-1, WC-2) instead of one combined row.';
