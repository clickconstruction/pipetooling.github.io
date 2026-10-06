SET lock_timeout = '3s';

-- Submittals: a revision the office sent outside the app (by email, on paper) and typed the GC's
-- answers onto (punch list #89, item 3). Set the first time an answer is entered on a draft row,
-- or by the office on step 5 (Sent by email on…). The header and the chips then read
-- "Rev 1 · sent by email · Sep 29" instead of "draft". Null on a revision shared from the app.
ALTER TABLE public.bid_submittals ADD COLUMN IF NOT EXISTS sent_outside_at timestamptz;
COMMENT ON COLUMN public.bid_submittals.sent_outside_at IS 'When the office sent this revision outside the app (by email or on paper); null when it was shared from the app or never sent.';
