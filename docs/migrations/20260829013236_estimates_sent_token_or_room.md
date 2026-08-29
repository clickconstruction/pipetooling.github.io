# 20260829013236 — sent estimates: token OR room (2026-08-29)

Bid Room live-E2E fix (v2.2476): `estimates_sent_requires_token` (baseline) required a
`public_token_hash` on every sent row, which rejected room-published COs — they carry no
per-CO token by design; the room link is their credential (`sign-bid-room` + `documentId`).
The invariant becomes: sent ⇒ token OR `bid_room_id`. Applied with `supabase db push`.
