# 20260906150000_mercury_reconcile_runs.sql (2026-09-06, v2.2949)

Journey map Tier 5 X4 (J33-F3 / N4 / N6, cluster C7), train T5-06 — reconciliation keeps a receipt.

- **`mercury_reconcile_runs`** (new): `id`, `ran_at`, `ran_by → users`, `months_back`, `accounts_checked`, `statement_lines`, `statement_lines_present`, `months_with_missing`, `current_within_epsilon` (nullable: none checkable), `scope` (the sentence), `summary jsonb` (per-account `ReceiptAccount` rows from `supabase/functions/_shared/reconcileReceipt.ts`). Index on `ran_at DESC`.
- **RLS**: SELECT for `is_banking_staff()` (dev, master, assistant-like — the same cohort that may run the check). No write policies: the `mercury-reconcile` edge function inserts service-role. Both read-only appliers run (CREATE TABLE rule).

Apply order: **push before or with the edge deploy** — the function's insert fails soft (`receiptSaved: false`, the check itself still returns) until the table exists; the client's "Last reconciled" list reads `[]` on a missing table's error and stays empty.
