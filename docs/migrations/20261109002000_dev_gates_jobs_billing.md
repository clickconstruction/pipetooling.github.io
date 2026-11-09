# 20261109002000_dev_gates_jobs_billing.sql (2026-11-08, v2.6756)

Punch list #188, PR 3 of the dev gates: Settings → Jobs, bills and liens, rows 19 to 21 and 23 to 26 of the audit table, taken as written by the owner on 2026-11-08. The kernel `src/lib/settings/jobsBillingGroups.ts` mounts each card for its row's audience; this is the database side of the cards that write, since `app_settings` takes writes from a dev alone unless a key-scoped policy says otherwise.

- **The owner's cards (rows 19, 20, 26)** — `INSERT`, `UPDATE` and `DELETE` on `app_settings` for `is_master_or_dev()` over `hide_hcp_entry_field` (the switch deletes its row when off), `default_labor_rate`, `trip_charge_client_not_home`, `trip_charge_site_not_ready` and `legal_particulars_v1` (the firm card's particulars).
- **The office's cards (row 21)** — the same three on `job_address_extra_localities_v1` and `tx_county_extra_mappings_v1` for `is_office_staff()`. Manage developments writes the `developments` table, whose policies admit the office already.
- **What a bill says (row 24)** — the same three on `physical_invoice_issuer_v1`, `physical_invoice_footer_presets_v1`, `stripe_invoice_footer_presets_v1` and `bill_customer_memo_presets_v1` for `is_dev() OR is_controller()`; each card's Reset clears its row.
- **Collections law firms (row 26)** — `legal_firms_master_or_dev_insert` / `_update` and `legal_firm_counties_master_or_dev_insert` / `_update`, beside the dev's; nobody deletes. `legal_save_county_coverage(jsonb)` restated word for word from `20261031160000` with its gate reading `is_master_or_dev()` and the refusal naming the owner beside the dev. `legal_replace_firm`, `legal_hand_off_counties` and `legal_retire_firm` stay a dev's: the row names the two tables and the county map.
- **Rows 23 and 25** — the uncollectible list reads `jobs_ledger` alone and HCP reconcile writes `jobs_ledger_payments`, which admits the office already; nothing to grant.

No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`, the function `CREATE OR REPLACE`: idempotent, additive.

**Order**: push right after the merge. The old client showed these cards to a dev alone; the new client shows them to their audiences, and until the push a save would come back as a refusal in words.
