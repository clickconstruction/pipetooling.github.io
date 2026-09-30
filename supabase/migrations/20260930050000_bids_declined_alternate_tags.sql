SET lock_timeout = '3s';

-- An alternate the customer turned down is now said, not inferred (the live walkthrough of
-- the alternates work, 2026-09-30). Until now a won bid's alternate that was not in
-- accepted_alternate_tags read as DECLINED, so a bid won before the question was ever asked
-- (BP398), or a group marked as an alternate after the win, silently dropped its rows from
-- the job. This list holds the alternates the customer said no to; one in neither list is
-- UNANSWERED and stays in the job's scope until someone answers. Written by the Won dialog
-- (the unticked offered alternates), the bid room's signature (the add-ons left unticked)
-- and the Counts tab's Taken? / Not taken buttons. Additive; no backfill — no bid had
-- answered the question before this list existed.

begin;

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS declined_alternate_tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.bids.declined_alternate_tags IS
  'Of alternate_group_tags, the groups the customer turned down. Only these leave the job''s scope; an alternate in neither this nor accepted_alternate_tags is unanswered.';

commit;
