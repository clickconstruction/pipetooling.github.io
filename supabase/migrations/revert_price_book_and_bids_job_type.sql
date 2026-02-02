-- Revert price book and bids.job_type (reverse of add_bids_job_type, create_price_book_*)
-- Drop in dependency order so FKs are respected.

DROP TABLE IF EXISTS public.bid_pricing_assignments;
DROP TABLE IF EXISTS public.price_book_entries;
DROP TABLE IF EXISTS public.price_book_versions;
ALTER TABLE public.bids DROP COLUMN IF EXISTS job_type;
