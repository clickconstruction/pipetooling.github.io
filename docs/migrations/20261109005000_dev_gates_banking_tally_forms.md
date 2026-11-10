# 20261109005000_dev_gates_banking_tally_forms.sql (2026-11-08, v2.6761)

Punch list #188, PR 8 of the dev gates: the controller's doors on Banking, the Contract library and Tally, rows 51 to 54, 60 and 62 of the audit table, taken as written by the owner on 2026-11-08. The database side of the doors that read or write rows only a dev could:

- **Banking → Stripe (row 51)** — `stripe_webhook_events` `SELECT` for `is_controller()` (the invoices she reads already).
- **Banking → Account nicknames (row 53)** — `mercury_account_nicknames` `INSERT` and `UPDATE` for `is_controller()`, beside the dev's and the office's read.
- **Accounting → the two switches (row 54)** — `UPDATE` on `accounting_label_auto_approve_rule_matches` and `ar_applied_deposits_count_as_income` for `is_controller()` (the rows are seeded, so no insert). Import CSV and Manual accounts are the edge functions `import-manual-transactions` and `manage-manual-account`, whose `ALLOWED_ROLES` gain the controller; redeployed with the PR.
- **Contract library → Forms (row 60)** — `contract_form_templates` `INSERT`, `UPDATE` and `DELETE` and `contract_form_pdf_opens` `SELECT` for `is_controller()`.
- **Tally → Payroll rules (row 62)** — `controller_all_payroll_rules` on `mercury_tally_payroll_rules`, and `bulk_apply_tally_payroll_rule_flags(jsonb)` restated word for word from `20260704140000` with `is_dev() OR is_controller()` in its gate. Marking a transaction payroll stays payroll access (`20260906130000`).

Row 52 (the Ledger and its sorting configuration) reads `mercury_transactions`, which the controller reads already. No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`, the function `CREATE OR REPLACE`: idempotent, additive.

**Order**: push right after the merge, then `supabase functions deploy manage-manual-account` and `supabase functions deploy import-manual-transactions`. Until the push the controller's Stripe Data tab reads empty and her nickname, switch, form and rule saves come back as refusals in words; until the deploys her CSV import and manual accounts answer *Forbidden*.

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
