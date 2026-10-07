# 20261006234500_legal_replace_firm.sql (2026-10-06, v2.4712)

Punch list #85, the firm's door, PR 2: replace the collections law firm in one call.

- **`legal_replace_firm(p_old_firm_id, p_name, p_handling_name, p_email, p_phone, p_contingency_pct, p_filing_cost)`** returns `{ ok, firm_id, retired_firm_id }` or `{ error }`, like the other `legal_*` calls. `SECURITY DEFINER`, `search_path = public`; execute granted to `authenticated` and revoked from `PUBLIC` and `anon`.
- **Dev only** (`is_dev()`), like every write to `legal_firms`.
- **Refuses** a blank name, a contingency outside 0 to 100 or a negative filing cost, an old firm that is no longer active (row locked `FOR UPDATE`), and an old firm with an account still with it: a working stage or an end the office has not closed, the portal's own set (`LEGAL_PORTAL_STAGES` in `_shared/legalStages.ts`, written out in the function). The refusal says how many and carries `open`.
- **Retires the old firm** and keeps its history: forgets its live link's Vault secret (`legal_portal_link_forget_secrets`), revokes the link (`revoked_at`, `token_secret_id = NULL`, as `revoke_legal_portal_link` does), sets `active = false` and stamps `paused_at`. The desk, the portal and `legal-notify-dispatch` read the active firm only, and the dispatcher also skips a paused one.
- **Adds the new firm** active, with `created_by = auth.uid()`. Retire before insert, in one transaction, so `legal_firms_one_active` never sees two active rows and there is never a moment with none.

No table change, no new table (no fence calls), no index. Additive and idempotent (`CREATE OR REPLACE`).

**Apply order:** after main's `20261006233000_gc_projects_trades_scope.sql` and `20261006234000_gc_plan_sets_questions.sql`, both applied on 2026-10-06. Either order with the client is safe. The window calls the function only when a dev presses **Replace the firm**; before the push it answers *Replacing needs a database update that is not live yet* (`legalReplaceErrorWords`).

**Verify after the push:** `select proname from pg_proc where proname = 'legal_replace_firm'` returns one row; the Legal desk's firm window shows **Replace with a new firm…** for a dev.
