# 20260903010000_auto_approve_salary_sessions.sql (2026-09-03, v2.2670)

Auto-approve system-materialized salaried clock sessions so they stop piling up in the human approvals queue (Aug 2026 stall: 3 weeks of zero approvals, salary rows a third of the 799h backlog).

- `auto_approve_salary_clock_sessions()` — SECURITY DEFINER; approves closed `origin = 'salary_schedule'` sessions with `approve_clock_sessions`' write semantics (incremental `people_hours` upsert + person-id resolve + crew job/bid sync). Guard: pg_cron context (`auth.uid() IS NULL`) or `is_dev()`. Skips blank-name/≤0-hour rows; 2-hour post-clock-out settle buffer (salary sync's close/adjust pass wins); UPDATE re-checks the approval flags and backs out the hours increment on a race with an interactive approval. `approved_by`/`entered_by` stay NULL and an existing human `entered_by` on the `people_hours` day is not clobbered.
- pg_cron `auto-approve-salary-sessions`, `*/30 * * * *`, plain-SQL job. Idempotent (unschedule-if-exists first).
- Kill switch: `app_settings.key = 'auto_approve_salary_sessions_disabled_v1'`, `value_text = '1'`.

Apply order: independent of client deploys — push any time after merge. First run drains the pending salary backlog; no separate backfill statement.
