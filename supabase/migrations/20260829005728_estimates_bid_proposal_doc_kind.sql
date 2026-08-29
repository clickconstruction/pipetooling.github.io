SET lock_timeout = '3s';

-- Bid Room fix (v2.2475): sign-bid-room mints estimates rows with doc_kind='bid_proposal'
-- (v2.2470), but estimates_doc_kind_check (20260819171817) still allowed only
-- ('estimate','change_order') — every live signature failed with "Could not record the
-- signature". Caught by the live end-to-end test on ZZ Test. Widen the check.

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_doc_kind_check;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_doc_kind_check
  CHECK (doc_kind IN ('estimate', 'change_order', 'bid_proposal'));
