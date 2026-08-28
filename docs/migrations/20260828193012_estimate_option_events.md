# 20260828193012 — option_viewed customer events (2026-08-28)

Estimate Options Phase 3 (v2.2462): widens both `estimate_customer_events` CHECK
constraints — `event_type` gains `option_viewed`, `source` gains
`log-estimate-option-view` (the new token-validated public edge function the acceptance
page reports option browsing through). Drop-and-re-add of the two named constraints;
idempotent via `DROP CONSTRAINT IF EXISTS`. Applied with `supabase db push`.
