# 20261109003500_dev_gates_pipeline_money.sql (2026-11-08, v2.6759)

Punch list #188, PR 6 of the dev gates: the Pipeline's money doors, rows 38 to 40, 44 and 45 of the audit table, taken as written by the owner on 2026-11-08. The owner reads Team labor and profit on every job already; these open the same figures where a dev and the controller alone read them.

- **Overhead dials (row 38)** and **the contract coverage floor (row 45)** — key-scoped `INSERT` and `UPDATE` on `app_settings` for `is_master_or_dev()` over `overhead_allocation_v1` and `job_contract_floor_cents_v1`.
- **Weekly money movement (row 39)** — `get_weekly_money_movement_payload(date)` restated word for word from `20260907130000` with its client gate reading `is_master_or_dev()` beside the controller.
- **The Billed aging and Paid profit charts (row 40)** — `get_billed_aging_costs()` and `get_paid_profit_stats()` restated word for word from `20260916190000` the same way.
- **Pay speeds (row 44)** — the controller writes and clears `pay_speed_no_count_date_v1` (`INSERT`, `UPDATE`, `DELETE` for `is_dev() OR is_controller()`), and the two `pay_speed_exclusions` policies from `20260825170000` are restated with `is_controller()` beside the dev and the master.

No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`, every function `CREATE OR REPLACE`: idempotent, additive.

**Order**: push right after the merge. Until the push the owner's Weekly money movement and the two charts answer *not allowed* in words, and his dial and floor saves come back as refusals.
