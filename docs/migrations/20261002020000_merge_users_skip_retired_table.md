# 20261002020000_merge_users_skip_retired_table.sql (2026-10-01, v2.4345)

Merge users works again. `merge_user_accounts` still named `cost_matrix_teams_shares` in its membership-table list after `20260715090000` dropped that table, so every merge and every dry run since 2026-07-15 failed with `relation "public.cost_matrix_teams_shares" does not exist`. The live body differs from the repo file (`20260907160000` edited it in place with `regexp_replace`), so this edits the live definition the same way and removes only that one tuple. Every other table the function names exists (checked with `to_regclass` on 2026-10-01). Idempotent; no client or edge-function change is needed, and nothing has to deploy first.

Dry run on prod in a rolled-back transaction as a dev (`request.jwt.claims` set to Robert): with the fix, `merge_user_accounts(<Sample helper>, <ZZ TEST Trial Helper>, true)` returned `ok` with `clock_sessions.user_id: 4`, `team_prospects.trial_user_id: 1`, `ui_nav_clicks.user_id: 1`, `user_app_activity_daily.user_id: 1`.

If another table on the function's lists is ever dropped, remove its tuple the same way in the same migration.
