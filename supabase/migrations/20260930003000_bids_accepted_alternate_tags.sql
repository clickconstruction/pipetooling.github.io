SET lock_timeout = '3s';

-- The customer's answer to a with-and-without alternate (alternates round two, PR 1). A bid's
-- alternate_group_tags (20260929230000) says which count-row groups are offered with and
-- without; this list says which of them the customer TOOK, written by the Won dialog or by
-- the bid room's signature. The agreed value (bids.agreed_value, already a column) becomes
-- the base plus the accepted alternates; bids.bid_value stays what was sent. A declined
-- alternate's rows stay on the bid and leave the job's takeoff, purchase list and labor
-- budget (the client reads both lists through one kernel). Additive; nothing else changes.

begin;

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS accepted_alternate_tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.bids.accepted_alternate_tags IS
  'Of alternate_group_tags, the groups the customer took on the win (Won dialog or bid-room signature). agreed_value = base + these; bid_value stays the sent base.';

commit;
