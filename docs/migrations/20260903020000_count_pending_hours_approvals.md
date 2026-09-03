# 20260903020000_count_pending_hours_approvals.sql (2026-09-03, v2.2671)

`count_pending_clock_session_approvals()` — SECURITY DEFINER, STABLE — returns one row `(sessions, total_hours, people, oldest_work_date)` over closed clock sessions with `approved_at`/`rejected_at`/`revoked_at` all NULL. Feeds the Dashboard Needs You `hours-approvals` item (v2.2671).

- Gate inside the function (`list_bulk_deletion_alerts` precedent): callers failing `is_dev()` / `is_pay_approved_master()` / `is_assistant_of_pay_approved_master()` / `is_assistant()` get the zero row — the card and the numbers can never disagree, and the client hook carries no role logic.
- Counts all origins; `salary_schedule` rows drain via `auto_approve_salary_clock_sessions` (20260903010000), and the client's 3-day oldest-age gate keeps them from ever triggering the card alone.

Apply order: independent — the client's RPC call fails soft (card stays quiet) until this is pushed.
