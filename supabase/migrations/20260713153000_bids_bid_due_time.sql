-- Optional time-of-day a bid is due, alongside bid_due_date (a plain date).
-- Wall-clock time exactly as entered; no timezone math (matches bid_due_date semantics).
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS bid_due_time time;
