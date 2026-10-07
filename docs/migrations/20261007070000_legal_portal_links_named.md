# 20261007070000_legal_portal_links_named.sql (2026-10-06, v2.4750)

The law firm's portal links carry the firm's name, a firm may hold several, and the office reads every one back ([v2.4750](../recent-features/v2.4750.md)).

1. `legal_portal_links` gains `purpose` (`firm` · `person`, default firm), `label` (required on a person link), `revoked_by`, `revoke_reason` (`rotated` · `off` · `replaced`). The unique live index becomes `idx_legal_portal_links_active_firm` (`firm_id` where live and `purpose = 'firm'`); person links are free.
2. The office's column grant adds the four columns; the token stays out.
3. `legal_portal_link_new_key(name)`: `<name as a slug, ≤ 40>-<12 from a–z0–9>` (`gen_random_bytes`). No grants.
4. `legal_portal_link_insert(firm, purpose, label)`: one row, its key in Vault, returns the raw key once. No grants (called by the verbs below).
5. `create_legal_portal_link(firm, label default null)`, `rotate_legal_portal_link(link)`, `revoke_legal_portal_link_by_id(link)`: the office's verbs (`legal_office_can_read()`). Rotate forgets the old secret (`legal_portal_link_forget_secret(link)`), stamps it rotated, mints a new one with the same purpose and label.
6. `list_legal_portal_links(firm)`: every row, newest first, with the live ones' keys from `vault.decrypted_secrets` and the makers' and enders' names. Office only.
7. `legal_portal_link_token(firm)` now reads the firm's own live link; `legal_portal_link_token_by_id(link)` is new. Both service role only.
8. `mint_legal_portal_link` and `revoke_legal_portal_link` are kept for the client that is live during the push, and stamp the new columns.

Locks: four `ADD COLUMN IF NOT EXISTS` with defaults and the index swap take ACCESS EXCLUSIVE on `legal_portal_links` (a handful of rows) for an instant; `SET lock_timeout = '3s'` first. No CREATE TABLE. Idempotent.

## Order

Merge (the client says the list is not live yet), `supabase db push`, then deploy `legal-portal`, `legal-send-firm-link`, `legal-notify-dispatch`; then regenerate types.
