# 20261113050000 — bridge_left_out_key_owner (v2.7095)

The owner's role saves what the Bridge leaves out (punch list #334, PR 2). Under its title `/bridge` says what it leaves out and lets a person change the list: whole developments, customers or addresses whose jobs, bids and estimates the page does not count. The list is one `app_settings` row, `bridge_left_out_v1`, saved with an upsert. Until now only the baseline's *Devs can manage app settings* admitted that write, so the owner's role, which has opened the page since `20261109006000_dev_gates_pages_quickfill.sql`, would have been refused: the change would hold for the visit and be lost.

- **`master_or_dev_insert_bridge_left_out_key`** (`FOR INSERT TO authenticated`) and **`master_or_dev_update_bridge_left_out_key`** (`FOR UPDATE TO authenticated`): the one key and `is_master_or_dev()`, the shape of `master_or_dev_*_bridge_cash_keys` (`20261112013000`). An upsert needs both.
- No delete policy: the page never deletes the row. A list that leaves nothing out is saved as an empty list.
- No seed: with no saved row the page reads an empty list and leaves nothing out.
- The table's restrictive write fences (read-only, digital twin, archived) still apply. No table is created, so no fence call is owed.
- Idempotent: each policy is dropped if it exists and made again.

Deploy order: none. The client reads the row before and after; the owner's save passes once this is pushed, and until then says why it was refused and holds for the visit.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659).
