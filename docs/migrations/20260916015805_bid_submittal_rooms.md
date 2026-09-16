# 20260916015805_bid_submittal_rooms.sql (2026-09-16, v2.3485)

Submittals stage 4a-i (`to-dos/submittals/README.md`, decisions 8–12): the review room.

- **`bid_submittal_rooms`** (new) — one per bid (`bid_id` UNIQUE): `token` UNIQUE (the durable link the GC forwards), `status` (`open · closed`), `shared_by/at`, `closed_by/at`, timestamps.
- **`bid_submittal_people`** (new) — one per person on a room: `name`, `email`, `role` (`architect · owners_rep · designer · builder · other`), `may_decide` (default true — the office's deciding/watching switch), `token` UNIQUE nullable (a personal link), `how` (`named · identified · forwarded`), `invited_by`, `first_seen_at`, `last_seen_at`, `open_count`, `closed_at`. UNIQUE (room_id, lower(email)).
- **`bid_submittal_events`** (new) — `room_id`, `person_id` (nullable — an anonymous open), `submittal_id` (nullable), `event_type` (`view · identified · decided · reply · file_dropped · shared · closed`), `metadata`, `client_ip`, `user_agent`, `occurred_at`.
- **`bid_submittal_items`** + `reviewed_by_person_id` (nullable FK to people).
- **Helper** `can_access_submittal_room(room_id)` (SECURITY DEFINER, `authenticated` only) walks a room to its bid's `can_access_bid_for_pricing`.
- **RLS** — rooms, people: the pricing sharers read and write on bids they can price; events: the pricing sharers read and insert (the functions write the rest with the service role). Outsiders never touch PostgREST. All three fence appliers.

Idempotent. Apply order: after the client merge; then deploy `get-submittal-room` and `open-submittal-pdf` (they select these tables). The old client never selects them; the new tab reads a missing room as "not shared yet".
