# 20260915180000_report_email_subscription_team_leads.sql (2026-09-15, v2.3480)

Report email recipients — team-lead scope (`docs/recent-features/v2.3480.md`).

- **`report_email_subscription_team_leads`** (id, subscription_id → `report_email_subscriptions` cascade, leader_user_id → `users` cascade, UNIQUE per pair): the sidecar beside `_authors`. RLS SELECT/INSERT/DELETE on `can_manage_report_email_subscriptions()`; both read-only fence appliers. `report_email_subscriptions`' table comment restated.
- **`list_report_email_team_leads()`** — SECURITY DEFINER, `authenticated`; `[]` unless the caller is a report-email manager; every leader with ≥1 member (`team_leader_assignments`), name + `member_count`, archived leaders excluded.
- **`get_my_email_schedule()` / `get_global_email_schedule()`** — `team_leads` names on each field-report subscription; bodies from `20260915170000` with only that addition.

Apply after `20260915170000`. Then `supabase functions deploy send-report-email` — until it is redeployed the dispatcher ignores lead rows (a lead-only subscription sends nothing; named authors and all-authors keep working).
