# 20260930050000_bids_declined_alternate_tags.sql (2026-09-30, alternates walkthrough fix)

`ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS declined_alternate_tags text[] NOT NULL DEFAULT '{}'` — of the bid's `alternate_group_tags`, the groups the customer **turned down**. Beside `accepted_alternate_tags` (`20260930003000`) it makes the answer three-way per alternate: taken, declined, or unanswered (in neither list). Until now a won bid's alternate that was not accepted read as declined, so a bid won before the question existed, or a group marked as an alternate after the win, silently dropped its rows from the job's takeoff, purchase list and labor budget. Only a declined alternate leaves the job's scope now.

Written by the Won dialog (the offered alternates left unticked), the bid room's signature (`sign-bid-room`, the add-ons left unticked) and the Counts tab's *Taken?* buttons on a won bid. No backfill: before this list existed no bid had answered the question (only BP398 carries an alternate, unanswered). `duplicate_bid_to_service_type` is untouched, like the accepted list: a duplicate is a new bid and starts unanswered.

Apply order: this migration first, then the client and `sign-bid-room` (an old client ignores the column).
