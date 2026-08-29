# 20260829005728 — doc_kind check admits bid_proposal (2026-08-29)

Bid Room fix (v2.2475): `estimates_doc_kind_check` (from `20260819171817`) allowed only
`('estimate','change_order')`, so every live `sign-bid-room` signature failed at the
estimates INSERT. Found by the live end-to-end test the same day the room shipped; the
function's signature-upload rollback behaved correctly throughout. Widened to include
`'bid_proposal'`. Applied with `supabase db push`.
