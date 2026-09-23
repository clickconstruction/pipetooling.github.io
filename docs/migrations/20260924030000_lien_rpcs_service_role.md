# 20260924030000_lien_rpcs_service_role.sql (2026-09-24, v2.3789)

Punch list **#41** PR 2 — counsel's grid on the law firm's portal. `list_lien_notice_months(integer)` and `list_lien_affidavit_windows(integer)` (the Lien desk's two RPCs, bodies v2.3747's verbatim) let the **service role** through their office-role gate (`OR auth.role() = 'service_role'` in the `me` CTE) and gain `GRANT EXECUTE … TO service_role`, so the `legal-portal` edge function can read the Timeline book (v2.3768's 400-day window) and hand it to the firm's page as the raw rows the desk's own hook reads. `CREATE OR REPLACE`, same signature and return table — no drop window; idempotent.

**Order:** push any time; the function reads the book only after `supabase functions deploy legal-portal`, and an older function simply omits `lienBook` (the page hides the panel). Nothing else calls these RPCs as the service role.
