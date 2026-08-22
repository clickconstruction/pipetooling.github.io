# 20260822162303 — checklist_reminder_upgrades (v2.2096)

Two additive columns on `checklist_items` for the reminder upgrades:

- `remind_day_before boolean NOT NULL DEFAULT false` — the scheduled reminder also fires the day **before** an instance is due (same reminder_time slot, "Due tomorrow" bucket).
- `escalate_after_days integer` (CHECK ≥ 1, NULL = never) — once an instance is this many days past due and still incomplete, the daily reminder also notifies the item's `created_by_user_id`.

No new table → no read-only-block calls needed. Consumed by `send-scheduled-reminders` (redeploy with this migration) and the Add/Edit checklist modals. See `docs/recent-features/v2.2096.md`.
