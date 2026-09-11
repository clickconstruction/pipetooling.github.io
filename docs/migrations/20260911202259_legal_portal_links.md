# 20260911202259_legal_portal_links.sql (2026-09-11, v2.3319)

Legal portal train, PR 3 — the collections law firm's no-login link.

- `legal_portal_links` — firm-keyed (`legal_firms.id`) capability links: raw `token` + `token_hash`, `created_by`, `revoked_at`; one active row per firm (partial unique index), unique token. Office-read via `legal_office_can_read()`; no anon access — the `legal-portal` edge function reads it through the service role. Token only: a firm gets one link, no printed address.
- `mint_legal_portal_link(firm_id, rotate)` — returns the existing active raw token, or revokes + re-mints in one transaction. Office roles.
- `revoke_legal_portal_link(firm_id)` — the kill switch.
- `public_page_views.surface` CHECK gains `legal_portal`.

Ends with both read-only blocks. Additive. Apply with `supabase db push` after the PR merges; deploy `legal-portal` after the push (it inserts `legal_portal` views and reads the new table).
