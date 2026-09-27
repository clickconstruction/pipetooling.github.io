# 20260927220000_controller_policies_the_rest.sql (2026-09-27, v2.3898)

Batch 3 of the controller-access audit (punch list #48, `to-dos/controller-access.md`). `ALTER POLICY` on the remaining 108 policies across 36 tables: the jobs ledger and its invoices, payments, fixtures, materials and team members; customers, their addresses and contacts; projects and workflow steps; sub labor sheets; inspections; reports; people; push subscriptions; dashboard goals.

The expressions were read back from `pg_policies` on production the same day, so the migration sets `search_path = public` for the unqualified `users` and `user_role` they carry. Each policy keeps its name and command. `SET lock_timeout = '3s'`. No client change is needed and the order with the client does not matter.

Verify after the push: as the sample controller, `customer_addresses`, `reports`, `inspections` and `workflow_step_line_items` return the same row counts as for the sample assistant.
