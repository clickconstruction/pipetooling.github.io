# 20260930003000_bids_accepted_alternate_tags.sql (2026-09-30, alternates round two PR 1)

`ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS accepted_alternate_tags text[] NOT NULL DEFAULT '{}'` — of the bid's `alternate_group_tags` (the with-and-without alternates, `20260929230000`), the groups the customer **took**. Written by the Bid Board's Won dialog and by the bid room's signature (`sign-bid-room`), the same fact through two doors. The existing `bids.agreed_value` becomes the base plus the accepted alternates; `bids.bid_value` stays what was sent. A declined alternate's rows stay on the bid and leave the job's takeoff, purchase list, labor budget and Budget card through one client kernel (`jobScopeRows`). `duplicate_bid_to_service_type` is untouched on purpose: a duplicate is a new bid and starts unanswered.

Apply order: this migration first, then the client (an old client ignores the column).
