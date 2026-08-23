SET lock_timeout = '3s';

-- v2.2162 (Bids by GC, G3): each version (GC packet) records its own outcome — "won with SPC,
-- lost with BURD" — so Followup and the Bid Board can read per GC. bids.outcome stays the roll-up.
ALTER TABLE public.bid_versions ADD COLUMN IF NOT EXISTS outcome text NULL;
ALTER TABLE public.bid_versions ADD COLUMN IF NOT EXISTS outcome_at date NULL;
ALTER TABLE public.bid_versions ADD COLUMN IF NOT EXISTS outcome_note text NULL;
COMMENT ON COLUMN public.bid_versions.outcome IS 'Per-GC outcome (won | lost | null); bids.outcome remains the bid-level roll-up (v2.2162).';
