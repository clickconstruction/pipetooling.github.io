# 20261109002500_dev_gates_people_page.sql (2026-11-08, v2.6757)

Punch list #188, PR 4 of the dev gates: the People page, rows 1 to 3 and 55 to 59 of the audit table, taken as written by the owner on 2026-11-08. The database side of the doors that write or read rows only a dev could:

- **Overhead → choose the office job (row 56)** and **Vehicles → Check-in settings (row 59)** — key-scoped `INSERT` and `UPDATE` on `app_settings` for `is_master_or_dev()` over `overhead_office_job_ledger_id_v1` and `vehicle_checkin_settings_v1`. Wheels writes the `vehicles` table under its standing policy, which admits a pay-approved master already.
- **Users → Tags (row 57)** — `SELECT`, `INSERT`, `UPDATE` and `DELETE` on `user_tag_org` for `is_master_or_dev()`, beside the dev's four and the person's own-row read.
- **Activity → the viewer grants (row 58)** — `SELECT`, `INSERT` and `DELETE` on `user_app_activity_viewers` for `is_master_or_dev()`, and `SELECT` on `user_app_activity_daily` for `is_master_or_dev()`, so the tab opens to the owner without a grant as it opens to a dev.

Rows 1 (Crew P&L), 2 (Review), 3 (Scoreboard) and 55 (the Balances and Payments views) read what their audiences read already: client lines alone. No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`: idempotent, additive.

**Order**: push right after the merge. The old client never showed these doors to the owner; the new client shows them, and until the push a save would come back as a refusal in words and the Activity tab would draw empty for him.
