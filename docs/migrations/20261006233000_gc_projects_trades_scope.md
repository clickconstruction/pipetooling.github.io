# 20261006233000_gc_projects_trades_scope.sql (2026-10-06, v2.4703)

GC mode, the real build, step 2: the first tables, from the prototype's model (`to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`), on the owner's word of 2026-10-06 that the prototype's shape is settled. Eight tables, nothing reads or writes them yet: New project on real data is step 4.

- **`gc_projects`**, one-to-one with a `projects` row (the customer, the address and the number stay there): `stage` (bidding · buyout · building · closed), `bid_due`, `sq_ft` and `size_note`, `customer_role` (owner · gc · owners_rep) and `property_owner_customer_id`, `architect_customer_id`, `project_manager_user_id`, `general_conditions`, `contingency_pct`, `fee_pct`, `drive_folder_url`, the lost-bid columns (`lost_on`, `lost_why`, `won_by`, `lost_note`), `created_by`, `created_at`.
- **`gc_trade_packages`**: one row per trade, `position`, `budget`, `ours`, `own_bid_id` (FK `bids`); unique per project and trade.
- **`gc_scope_items`**: a trade's scope lines, `sheets` / `specs` (null follows the kernels' guess), `added_in_set_id` (the set that brought the line in late; its foreign key comes with `gc_plan_sets` in step 3).
- **`gc_scope_exclusions`**: what a trade's quote leaves out and who does it instead.
- **The scope book's four tables**, company-wide, one per list in the kernel's `ScopeBookStore` (`src/lib/gc/scopeBook.ts`): `gc_scope_book_saved`, `gc_scope_book_edits` (with `clear_spec` / `clear_leaves_out` for the kernel's nulls), `gc_scope_book_merges`, `gc_scope_sets`.

RLS: every table has one `FOR ALL` policy for `is_dev()` (decision 2: dev only while it is built). A later migration opens the project tables to master and controller, and the scope book to estimators, once a screen reads them. `created_by` / `saved_by` / `edited_by` / `merged_by` default to `auth.uid()`.

Ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: any. No client reads these tables until step 4. Additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). The next migration, `20261006234000_gc_plan_sets_questions.sql`, adds the plan sets and questions and the foreign key on `gc_scope_items.added_in_set_id`.
