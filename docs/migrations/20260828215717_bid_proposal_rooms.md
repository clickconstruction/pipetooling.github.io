# 20260828215717 — bid proposal rooms (2026-08-28)

Signable Bids Phase 1 (v2.2468): `bid_proposal_rooms` (durable per-GC-packet link;
plaintext portal-style token; partial-unique on open rooms per bid×GC and per bid for the
own-GC null case), `bid_proposal_room_revisions` (explicit publishes: rev number, note,
letter payload jsonb), `bid_proposal_room_events` (room_view / option_viewed / link_sent /
signed / declined). RLS: staff read for the bid-pricing role set, writes for the tighter
set (bid_gc_recipients pattern); the GC side never touches PostgREST — token-validated
service-role edge functions only. Ends with both read-only appliers + the digital-twin
write fence (house rules). Applied with `supabase db push`.
