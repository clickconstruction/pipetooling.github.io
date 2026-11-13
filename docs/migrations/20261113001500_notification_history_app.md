# 20261113001500_notification_history_app.sql (2026-11-12, v2.7068)

A notice shown in the app only. When a developer saves a conversation out of a teammate's mailbox onto a job through the dev seat, the mailbox's owner is told by one `notification_history` row of their own (`gmail-mine`'s `noteSavedForYou`, `template_type` `mail_saved_for_you`). The owner chose the app alone on 2026-11-12: nothing is pushed and nothing is emailed.

## What it does

1. Drops `notification_history_channel_check` and adds it back with `app` in the list (`DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT`, the house's shape for widening a check; idempotent).
2. Comments `notification_history.channel` with what `app` means.

No new table, so no fences.

## Why

The check allowed `email`, `push`, `both` and `held`. None is true of this row: no email went, no push went, and `held` is a push that was not sent because the person was outside their Push me hours, which the Dashboard lists as what waited. A notice that was never going to be pushed needs its own word, so that the record says how the person was reached.

## Push it

`supabase db push` from `main` after the PR merges, **before** `gmail-mine` is deployed. Until it is pushed the function's insert is refused by the old check; the function logs `gmail_mine_owner_not_told` and the save still stands, so the order costs a notice and never a save.

## Rollback

Add the constraint back without `app` once no row carries it (`DELETE FROM notification_history WHERE channel = 'app'` first).

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659).
