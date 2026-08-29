SET lock_timeout = '3s';

-- Bid Room fix #3 from the live E2E (v2.2476): estimates_sent_requires_token (baseline)
-- requires a public_token_hash on every sent row. A room CO deliberately has no per-CO
-- token — the ROOM link is its credential (sign-bid-room authenticates by room token and
-- documentId) — so the invariant becomes: sent ⇒ token OR room.

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_sent_requires_token;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_sent_requires_token
  CHECK (status <> 'sent'::public.estimate_status OR public_token_hash IS NOT NULL OR bid_room_id IS NOT NULL);
