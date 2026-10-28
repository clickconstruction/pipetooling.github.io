# 20261028210000_notification_history_held.sql (2026-10-28, v2.6029)

A push held for a person's hours (punch list #141 PR 3, `to-dos/quiet-hours/README.md` → The plan → PR 3, decision 3). `messages-notify` now holds a reply's push for whoever is outside their **Push me** hours (`user_push_hours`, `20261028200000`) and writes the row it would have sent with `channel = 'held'`, never sending it. The channel check on `notification_history` allowed `email`, `push` and `both`; it now allows `held`. Push this one right after `20261028200000`, then deploy `messages-notify`, which reads the table and writes the rows: until the constraint is widened the function logs the refused held rows and sends nothing to the held person, so nothing buzzes wrongly in the window, but nothing is recorded either.

## What it does

1. Drops `notification_history_channel_check` and adds it back with `held` in the list (`DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT`, the house's shape for widening a check; idempotent).
2. Comments `notification_history.channel` with what `held` means.

No new table, so no fences.

## Why

Decision 3 of the card: a held push is still a `notification_history` row, so the line is never pushed to that person later (`messages-notify` reads `message_id` and `template_type` back) and the Dashboard's Needs you line (PR 4) can read what waited from the person's own rows. Settings → Activity logs' *Most recent push notifications* reads `channel in ('push', 'both')`, so a held row never shows as a push that went.

## Verify

Read-only on prod after the push: `select conname, pg_get_constraintdef(oid) from pg_constraint where conname = 'notification_history_channel_check'` reads the four channels. Once `messages-notify` is deployed and someone with hours is off when a customer writes to them: `read_rows notification_history` where `channel = 'held'` shows their row with the line's `message_id`, and the office's own rows for the same line carry `template_type = 'message_reply_off'`.
