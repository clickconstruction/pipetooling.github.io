# 20260911203141_cashapp_reconcile — Cash App reconciliation tables (v2.3321)

**What**: `cashapp_transactions` (the Cash App activity export, pk = Cash App Transaction ID, plus the reconcile decision: lane / person / match rule / links to `pay_stub_payments` or `person_offsets`), `cashapp_aliases` (counterparty → person, not-staff flag, optional note rule for proxy accounts), and `advance` added to `person_offsets_type_check`.

**Access**: both tables RLS `has_payroll_access()` on SELECT/INSERT/UPDATE/DELETE; `service_role` all. Both read-only blocks applied.

**Why**: v2.3321 — groundwork for the Cash App reconcile tool on People → Pay → Payroll → Pay run (PRs 2–4). See `docs/recent-features/v2.3321.md`.

**Idempotent**: `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, constraint drop/add. Additive; no data touched.
