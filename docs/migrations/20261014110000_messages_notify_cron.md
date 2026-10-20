# 20261014110000_messages_notify_cron.sql (2026-10-13, v2.5481)

Messages, residential R5's push, PR 3 of 3 (Customer communication helper 2, directed by the lead "cc"). It adds the
switch and the minute cron for `messages-notify`'s push for a reply (v2.5479). Push it after that PR lands **and after
the lead deploys `messages-notify`**, so the first sweep reaches the new body. The switch ships off, so nothing posts
either way until the owner turns it on.

## What it does

1. **The switch.** `app_settings` `messages_reply_push_on_v1` ships `'false'`.
   - The owner or a dev turns it on or off through its own key-scoped UPDATE policy,
     `master_or_dev_update_messages_reply_push_on`. That is the shape of `gmail_sync_on_v1`'s.
   - `messages-notify` checks it too (`REPLY_PUSH_ON_KEY`). A writer's call sends nothing while it is off, and so does
     a call before this row exists.
2. **The cron row `messages-reply-push`** runs every minute (`* * * * *`) and posts `{"sweep": true}` to
   `/functions/v1/messages-notify`.
   - It uses Vault's `PROJECT_URL` and `CRON_SECRET`, as `gmail-sync`'s and `photo-save`'s crons are scheduled.
   - It posts only while the switch is on.
   - The row is unscheduled and scheduled again by name, so running the migration again leaves one row.

No table, so no fences. Idempotent.

## Checked before the push

The SQL bed `messages-notify-cron` (`npm run test:pg:messages-notify-cron`) runs every migration, then this one a
second time, then the scenario:

- The switch ships off.
- There is one cron row, every minute, posting the sweep to messages-notify with the cron secret and reading the switch.
- With the switch off, the cron's own statement selects nothing to post.
- An assistant neither turns it on nor off, a dev turns it on, and the owner turns it off.

`src/lib/messages/notifyPlan.test.ts` holds `REPLY_PUSH_ON_KEY` to this file's row and its cron's WHERE.

## Verify after the push

```sql
-- One row, every minute, posting to messages-notify; the switch off.
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'messages-reply-push';
SELECT value_text FROM public.app_settings WHERE key = 'messages_reply_push_on_v1';
-- Once the owner turns it on, the runs and their answers.
SELECT status, return_message, start_time FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'messages-reply-push') ORDER BY start_time DESC LIMIT 5;
```

Expect one active row on `* * * * *` and `'false'`. Once the switch is on, the function answers
`{ success, lines, sent, reached, waiting, answered, late }` in its own logs.

## Turning it on

First the live test. A text from the owner's phone to the company number lands on a customer's thread. The tech who
texted them hears at once, and the office hears after the wait. Then a dev or the owner sets the switch:
`UPDATE public.app_settings SET value_text = 'true' WHERE key = 'messages_reply_push_on_v1';` from their own sign-in,
or with the service role. A Settings press for it is a later PR.

## Rolling back

`SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'messages-reply-push';` stops the calls. The switch row and
its policy are harmless left in place.
