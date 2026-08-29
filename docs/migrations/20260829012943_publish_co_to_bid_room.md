# 20260829012943 — publish_co_to_bid_room RPC (2026-08-29)

Bid Room live-E2E fix (v2.2476): SECURITY DEFINER RPC for the staff "Publish to bid room"
door — draft→sent is a privileged transition (`estimates_update_draft` pins status to
draft), so the client calls this instead of updating directly (the `apply_estimate_to_job`
precedent). Role-checked inside (dev/master/assistant/controller/estimator); validates the
CO belongs to the room's bid and the room is open; logs a `document_published` room event
(the events CHECK is widened in the same file). Applied with `supabase db push`.
