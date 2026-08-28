# 20260828070000 — digital twin write-fence + twin_runs (v2.2428)

Digital twins Phase E2 (`docs/DIGITAL_TWINS_PLAN.md`).

- `is_digital_twin()` — SECURITY DEFINER lookup of `users.is_digital_twin` for
  `auth.uid()`; false for anon and every real person.
- `apply_digital_twin_write_blocks()` — sweeps every RLS-enabled public table with three
  RESTRICTIVE policies (`digital_twin_write_fence_{insert,update,delete}`):
  `(NOT is_digital_twin()) OR (<allowance>)`. Allowance map:
  - `bids`: INSERT `created_by = auth.uid()`; UPDATE/DELETE `created_by = auth.uid() OR
    estimator_id = auth.uid()` (assignment-is-the-grant).
  - any table with a `bid_id` column: EXISTS against an owned/assigned bid (auto-covers
    future bid-family tables on rerun).
  - `price_book_entries`: via `price_book_versions.bid_id` join (template books stay
    read-only — no bid_id, no allowance).
  - `help_feedback`: INSERT true (bug reports), modify false.
  - everything else: false.
  Drop+recreate per policy → rerunnable to converge predicate changes; **rerun it in any
  future migration that CREATE TABLEs a bid-family table** (alongside the two read-only
  appliers the house rule already requires).
- `twin_runs` table: fleet ledger (service-role written by the `twin-login` edge function;
  dev-only SELECT). Ends with BOTH `apply_read_only_write_blocks()` +
  `apply_read_only_stmt_blocks()`.
- Safety posture: identical mechanism to training mode (restrictive, additive, no-op for
  non-flagged users), which has run on every table since 2026-07-13.
