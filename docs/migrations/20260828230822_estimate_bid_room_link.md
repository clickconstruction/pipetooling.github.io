# 20260828230822 — estimates.bid_room_id + document_published event (2026-08-28)

Bid Room Phase 4 (v2.2472): change orders join the room. Adds nullable
`estimates.bid_room_id` (FK → bid_proposal_rooms, SET NULL) — a CO published into a room
freezes there (status sent, no email, no per-CO token; the room link is the credential)
and the GC signs it via sign-bid-room. Widens the room events CHECK with
`document_published`. Additive + idempotent; applied with `supabase db push`.
