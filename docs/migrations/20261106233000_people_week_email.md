# 20261106233000_people_week_email.sql (2026-11-06, v2.6603)

Punch list #273, PR 5 of six: Your people's week, the Monday email, a Report Subscriptions stream (`people_week`). Taunya's goal 4 of 2026-11-06.

## What it does

1. **`people_week_email_requests`**: one row per scheduled send, `requested_by` and `recipient_user_id` (the same person: one subscribes oneself), `people_user_ids uuid[]` (1 to 50), `send_at`, `repeat_weekly`, `sent_at`, `error`, `attempts`. **Insert** in one's own name, as one's own recipient, and either an office role (`is_dev_or_master_or_assistant()`, the controller included) or a list of exactly oneself; **read** requester, recipient or a dev; **delete** a pending row's requester or recipient, or a dev; no client UPDATE. The four fence calls close it.
2. **`get_people_week_payload(p_recipient, p_people, p_week_start)`** (`SECURITY DEFINER`, service role only): for the week starting `p_week_start` (a Monday), per person the one-off and roadmap cards that finished or moved (from the last progress line before the week to the percent now, the lines ticked, the photos taken that week, the last what-is-left words), the roadmap tasks among them with their stage and roadmap, the jobs the person clocked on with the job's percent and their reports that week, and the open cards stuck past a month with no move. Reads `checklist_instance_events.percent` and the three tables of `20261106230000`.
3. **`get_my_email_schedule` and `get_global_email_schedule`** restated word for word from `20261010022000` (the newest definition) with `people_week` beside `gc_money_monday`: the one-off list carries `{stream: 'people_week', send_at, sent_at, repeat_weekly, detail: '3 people'}`, the global answer `people_week_requests`. The restatement is assembled from the source file by a script, so no clause of the other streams is retyped.
4. **The cron `people-week-email`** on the `2-57/5` lane (with gc-statement and statement-round, the least busy on 2026-11-06), calling only while a due row waits.

## Order

Push right after PR 5's merge, before the Pages deploy finishes: the subscribe sheet inserts into the new table and Settings → My email schedule reads the restated RPC. Deploy `people-week-email` right after the push (it reads the table and calls the payload RPC every run).

## Rollback

Drop the table, the payload function and the cron entry, and re-run `20261010022000`'s two schedule functions.

**Applied** to prod by 2026-11-07, read on 2026-11-07: `npm run check:migration-drift` from the docs worktree read 1153 local files and 1153 remote versions, fully applied, this file among them; the #255 card's note of the same day (#7230) says `people-week-email` and `your-week-email` were redeployed and nothing of the train is behind.
