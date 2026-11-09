# 20261109004000_dev_gates_notifications_misc.sql (2026-11-08, v2.6760)

Punch list #188, PR 7 of the dev gates: the billing notification windows and the office's small doors, rows 41 to 43, 46 and 48 to 50 of the audit table, taken as written by the owner on 2026-11-08. The database side of the doors that write rows only a dev could:

- **The recipient lists (rows 41, 42)** — key-scoped `INSERT` and `UPDATE` on `app_settings` for `is_dev() OR is_controller()` over `paid_job_email_recipients_v1`, `payment_made_email_recipients_v1`, `ready_to_bill_notify_recipients_v1`, `ready_to_bill_notify_recipients_v2`, `ready_to_bill_notify_channels_v1` and `signed_agreements_notify_recipients_v1` (the owner holds the same keys since `20261109000500`, for Emails & reports).
- **GC Review → Standing copies (row 43)** — `office_delete_unsent_standing_gc_statement_requests`: `is_office_staff()` removes a `repeat_weekly` request with `sent_at IS NULL`, whoever wrote it; the insert policy admits the office's own rows already.
- **Dispatch settings → Travel hints (row 50)** — the office's `INSERT` and `UPDATE` on `travel_hints_config_v1` and on `dispatch_note_requirement_config_v1`, which the same Save writes (it had no key policy, so a non-dev's Save was refused on that key).

Rows 46, 48 and 49 need nothing here: the Stripe Dashboard links read what the window has, `workflow_projections` admitted `is_office_staff()` since the one-company sweep, and the paid-in-full email's gate is in the edge function `paid-job-email` (`SENDER_ROLES`), redeployed with this PR. No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`: idempotent, additive.

**Order**: push right after the merge, and `supabase functions deploy paid-job-email`. Until the push the controller's recipient saves come back as refusals in words; until the deploy an assistant's paid-in-full send answers *Forbidden*.
