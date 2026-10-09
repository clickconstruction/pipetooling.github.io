SET lock_timeout = '3s';

-- Submittals, decision 11 (the owner's call of 2026-10-09): the app may send the room link. Each send
-- from send-submittal-room-link writes a 'link_sent' event on the person, so the Share step reads
-- "link sent Oct 9" and knows the office has sent from the app on this bid. The type check gains that
-- one value; every other value is as 20260916204602 left it. Idempotent: the check is dropped and made
-- again. No new table, so no read-only or digital-twin fences to re-apply.

ALTER TABLE public.bid_submittal_events DROP CONSTRAINT IF EXISTS bid_submittal_events_type_check;
ALTER TABLE public.bid_submittal_events ADD CONSTRAINT bid_submittal_events_type_check
  CHECK (event_type IN ('view', 'identified', 'decided', 'reply', 'file_dropped', 'shared', 'closed', 'asked', 'link_sent'));
