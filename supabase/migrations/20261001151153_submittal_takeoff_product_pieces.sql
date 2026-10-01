SET lock_timeout = '3s';

-- v2.4292 · The product of a submittal row built from the takeoff is the fixture's pieces (the
-- bowl + flush valve + seat + carrier), not one line; trim (stops, supplies, traps, flanges) starts
-- off. The estimator switches pieces in Choose from the takeoff and the choice is remembered beside
-- the tick: the part line ids that make the product. NULL = the default rule; '{}' = none on.
-- Additive; no rewrite.
ALTER TABLE public.bid_submittal_takeoff_choices ADD COLUMN IF NOT EXISTS product_line_ids uuid[] NULL;
COMMENT ON COLUMN public.bid_submittal_takeoff_choices.product_line_ids IS 'v2.4292: bids_takeoff_rough_part_lines ids switched on in the row''s product; NULL = default (every non-trim line).';
