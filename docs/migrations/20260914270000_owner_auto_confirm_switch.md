# 20260914270000_owner_auto_confirm_switch.sql (2026-09-15, v2.3450)

Owner of record, PR 3 — the nightly save-from-the-roll switch, decision 5 ([`docs/recent-features/v2.3450.md`](../recent-features/v2.3450.md)).

- **`app_settings.owner_auto_confirm_from_roll_v1` = 'false'** (`ON CONFLICT DO NOTHING`) — the switch on Settings → Jobs & billing, off on day one. Policy **`master_or_dev_update_owner_auto_confirm_from_roll`**: a key-scoped UPDATE for `is_master_or_dev()` (the `accounting_label_auto_approve` pattern, `20260905180000`); dev already manages every row, everyone authenticated reads.
- **`list_jobs_owner_to_confirm()`** re-created with the same signature and body (v2.3447) plus one rung in its gate: `auth.role() = 'service_role'`, so the nightly function reads the same list the Fix-ups chip counts. `GRANT EXECUTE … TO authenticated, service_role`.
- **`cron.schedule('owner-confirm-nightly', '15 8 * * *', …)`** → `net.http_post` to `/functions/v1/owner-confirm-nightly` with the vault `PROJECT_URL` and `CRON_SECRET` (the `billed-report-email` pattern, `20260803100000`); unschedules any earlier job of the same name first. 08:15 UTC is 03:15 Central in summer, 02:15 in winter. The function is a no-op while the switch is off, so the schedule is safe on its own.

No tables, no columns. Additive and idempotent. Apply order: merge → `supabase functions deploy owner-confirm-nightly` (the parent session deploys) → `supabase db push`. The old client ignores the row; the switch block reads `false` until the row exists and refuses to flip until it does.
