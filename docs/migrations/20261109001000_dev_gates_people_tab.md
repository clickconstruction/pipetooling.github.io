# 20261109001000_dev_gates_people_tab.sql (2026-11-08, v2.6755)

Punch list #188, PR 2 of the dev gates: Settings → People & teams becomes the office's tab with a gate per block (rows 8 to 13 and 22 of the audit table, taken as written by the owner on 2026-11-08). The database side of the blocks that write:

- **The owner's switches (rows 8, 9, 11)** — key-scoped `INSERT` and `UPDATE` on `app_settings` for `is_master_or_dev()` over the nine keys Quick time add, Typed hours: a second person approves, Assistant hours visibility, Bulk hours alert and Team review cadence upsert (`quick_add_roles_v1`, `quick_add_daily_ceiling_minutes`, `typed_hours_second_look_v1`, `assistant_hours_window_weeks_v1`, the four `bulk_hours_alert_*_v1` keys, `team_review_cadence_days_v1`).
- **The Task Dispatch and Estimator Inbox groups (row 10)** — `SELECT`, `INSERT` and `DELETE` on `dispatch_group_members` and `estimator_group_members` for `is_master_or_dev()`, beside the dev's three and the member's own-row read.
- **Additional People (row 12)** — `office_update_non_login_people` and `office_delete_non_login_people` on `people`: `is_office_staff()` on a row whose `account_user_id IS NULL`. A person with a login keeps the desk's gates (row 106); the creator's own-row policies stand.
- **The sub portal pay schedule (row 22)** — `INSERT` and `UPDATE` on `sub_pay_run_day` and `sub_pay_explainer` for `is_dev() OR is_controller()`.

Pay Approved Leaders (row 86, held by the `check_show_in_hours_dev_only` trigger) and Role visibility (row 87) stay a dev's; nothing here touches them. No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`: idempotent, additive.

**Order**: push right after the merge. The old client never showed these blocks to anyone but a dev; the new client shows them, and until the push a save would come back as a refusal in words.
