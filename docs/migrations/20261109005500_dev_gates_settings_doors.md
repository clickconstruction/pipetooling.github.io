# 20261109005500_dev_gates_settings_doors.sql (2026-11-08, v2.6762)

Punch list #188, PR 9 of the dev gates: the Settings doors that a policy or an RPC guarded, rows 6, 7, 16, 30 and 31 of the audit table, taken as written by the owner on 2026-11-08.

- **Training (row 6)** — `training_courses` `INSERT`, `UPDATE` and `DELETE` for `is_master_or_dev()`, beside the dev's three; reads were everyone's already.
- **Usage (row 7)** — `usage_page_minutes`, `usage_nav_clicks`, `usage_customer_views` and `usage_user_minutes` restated word for word from `20260826161242` with their gate reading `is_master_or_dev()` and the refusal naming the owner beside the dev.
- **Company documents (row 16)** — `company_documents` `INSERT`, `UPDATE` and `DELETE` for `is_master_or_dev()`, beside the dev's three; the office's read stands.
- **Contracts and clauses (row 30)** — `gc_clause_approve_team()` redefined with `role IN ('dev', 'master_technician', 'controller')`; every approve policy and RPC reads the function, so nothing else moves. `src/lib/gc/access.test.ts` reads this definition against `GC_CLAUSE_APPROVE_TEAM`.
- **Most recent emails sent (row 31)** — `email_send_log` `SELECT` for `is_master_or_dev()`, beside the dev's and the GC Review cohort's two statement types.

No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`, every function `CREATE OR REPLACE`: idempotent, additive.

**Order**: push right after the merge. Until the push the owner's Training and Usage tabs read refusals in words, his company document and clause saves are refused, and the email log reads empty for him.

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
