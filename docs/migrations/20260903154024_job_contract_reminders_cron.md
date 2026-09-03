# 20260903154024_job_contract_reminders_cron.sql (2026-09-03, v2.2690)

**Contract Desk PR 5** — schedules pg_cron job `job-contract-reminders` (hourly at :23) that `net.http_post`s the `remind-job-contracts` edge function with `X-Cron-Secret`, using the `PROJECT_URL` / `CRON_SECRET` vault secrets already in place for `crew-day-email-dispatch`. The function drains `job_contracts` rows that are `sent`, have `reminders_enabled`, and whose `next_reminder_at` is due (set by `send-job-contract` to +3 days), emails the customer the same durable link, advances `reminder_count` / `next_reminder_at` (3 days apart, up to 3), and logs a `reminded` event.

Kill switch: `app_settings` key `job_contract_reminders_disabled_v1` = `'1'` (no unschedule needed).

**Apply order**: deploy `remind-job-contracts` first (or at least before :23 the next hour) — an unscheduled call to a missing function just 404s harmlessly.
