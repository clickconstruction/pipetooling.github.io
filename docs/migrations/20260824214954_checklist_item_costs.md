# 20260824214954_checklist_item_costs.sql — dev-only task cost estimates (v2.2250)

New table `checklist_item_costs`: one row per costed checklist/roadmap task.

- `cost_key uuid PRIMARY KEY` — the roadmap task id for bridged roadmap tasks
  (so Review rows and the roadmap Plan view share one estimate per task), the
  `checklist_items` id otherwise. **Deliberately no FK**: the key references
  either of two tables, and an orphaned estimate is harmless (it stops
  rendering).
- `person_user_id` (FK users, SET NULL), `person_name` — who the estimate is
  costed against.
- `hours` (`> 0`), `rate` (`>= 0`) — `rate` is a **snapshot** of
  `people_pay_config.hourly_wage` at entry time; later pay changes don't
  rewrite history.
- `created_by_user_id` (FK users, SET NULL), `updated_at`.

RLS: single policy `checklist_item_costs_dev_all` — `is_dev()` for USING and
WITH CHECK. Estimates derive from payroll wages; no other role may read or
write them. Ends with both `apply_read_only_write_blocks()` and
`apply_read_only_stmt_blocks()` per the CREATE TABLE rule.

Idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`). Client:
`src/lib/checklistCostStore.ts`.
