SET lock_timeout = '3s';

-- The Bid Room, Phase 4 (v2.2472): change orders join the room. A CO (an estimates row,
-- doc_kind='change_order' — the v2.1835 bridge) published into a room gets `bid_room_id`;
-- the room page lists it as the next document in the thread and the GC signs it there via
-- sign-bid-room (room token = the credential; no per-CO public token needed). The room's
-- event CHECK gains 'document_published' for the publish audit.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS bid_room_id uuid REFERENCES public.bid_proposal_rooms(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.estimates.bid_room_id IS
  'Bid Room this document is published into (v2.2472): the GC signs it on the room page; room token is the credential.';

ALTER TABLE public.bid_proposal_room_events
  DROP CONSTRAINT IF EXISTS bid_proposal_room_events_event_type_check;
ALTER TABLE public.bid_proposal_room_events
  ADD CONSTRAINT bid_proposal_room_events_event_type_check
  CHECK (event_type = ANY (ARRAY['room_view'::text, 'option_viewed'::text, 'link_sent'::text, 'signed'::text, 'declined'::text, 'document_published'::text]));
