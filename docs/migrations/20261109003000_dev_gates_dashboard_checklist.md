# 20261109003000_dev_gates_dashboard_checklist.sql (2026-11-08, v2.6758)

Punch list #188, PR 5 of the dev gates: the Dashboard, Checklist, Roadmap card, Reply book and recurring-report doors, rows 33 to 37, 47 and 64 to 66 of the audit table, taken as written by the owner on 2026-11-08. The database side of the doors that read or write rows only a dev could:

- **Help feedback inbox (row 34)** — `SELECT` and `UPDATE` on `help_feedback` for `is_master_or_dev()`, beside a sender's own-row read.
- **Email schedule → Send to another user (row 36)** — `schedule_day_email_requests_insert_office_any_recipient`: `is_office_staff()` may queue the day's schedule email for any live recipient, beside the dev's policy and everyone's own-row insert.
- **Recurring email reports for any leader (row 47)** — the owner's `INSERT` and `DELETE` on `recurring_job_report_schedules` and `INSERT` and `UPDATE` on `recurring_job_report_schedule_recipients` (`20261109000500` gave him the schedule update and the recipient delete).
- **Reply book (row 64)** — `bid_reply_book_entries_update_own_or_dev` and `_delete_own_or_dev` restated from `20260928144511` with `is_master_or_dev()` beside the author.
- **Task cost lens (row 66)** — `checklist_item_costs_dev_all` restated from `20260824235336` with `is_master_or_dev()` beside the dev and the controller.

Rows 33 (the pay-approved owner reads `clock_sessions` already), 35 (the forward buttons) and 37 (the roadmap card) read what their audiences read already: client lines alone. No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`: idempotent, additive.

**Order**: push right after the merge. Until the push the owner's Help feedback inbox reads his own rows alone, a recurring report he schedules on another leader's scope and a reply he changes come back as refusals in words, and the cost chips stay hidden for him by the table's policy.

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
