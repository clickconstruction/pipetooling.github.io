# 20260831194854 — undo RPC matches the dispatch NCNS note (v2.2540)

`CREATE OR REPLACE` of `pay_staff_remove_not_coming_in_for_user_day` with one
change: the `user_time_off` delete predicate widens from
`note = 'Not coming in'` to `note IN ('Not coming in', 'No call, no show')`,
so the board's undo flow can clear the schedule marking a dispatch NCNS
writes. Everything else (auth gates, salary re-sync, return shape) is the
baseline body verbatim. Idempotent; no table or RLS changes — and clearing
the marking never touches `attendance_incidents`.
