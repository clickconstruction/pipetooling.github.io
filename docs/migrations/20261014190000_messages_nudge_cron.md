# 20261014190000_messages_nudge_cron.sql (2026-10-14, v2.5506)

Messages, cut 5, PR D: the cron of the morning run of the reminders the app sends itself, `messages-nudge-dispatch` (v2.5442, `docs/EDGE_FUNCTIONS.md` → messages-nudge-dispatch). The function was deployed on 2026-10-14 before this was pushed, so the cron never posts to a function that is not there.

## What it does

1. **Unschedules** any job named `messages-nudge-dispatch`, so a second push leaves one job.
2. **Schedules** `messages-nudge-dispatch` at `0 14,15 * * *`. It runs `net.http_post` to `PROJECT_URL` + `/functions/v1/messages-nudge-dispatch`, with the `X-Cron-Secret` header and an empty JSON body, both secrets read from `vault.decrypted_secrets`. It is the shape of `gc-office-notices`' and `gmail-sync`'s crons.

## Why two ticks

pg_cron runs on UTC, and 9 AM Central is 14:00 UTC in summer and 15:00 UTC in winter. The function runs only the tick that is 9 AM Central (`runHourNow`). The other tick answers `{ ran: false }` and reads nothing.

## Why it posts every morning

The run writes its summary to `app_settings` `messages_nudge_last_run_v1` even when it sends nothing: what was kept back and why. So the owner sees what the run would do before turning a step on. A text goes only when both switches allow it:
- the step is on in `messages_nudge_app_sends_v1`, which shipped as `{}`;
- Send texts is on in `messages_texts_on_v1`.

## Safety

- `SET lock_timeout = '3s'` first.
- No table, so no fences.
- Idempotent: the unschedule makes a second push leave one job.

## Verify on prod (read only)

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'messages-nudge-dispatch';
SELECT key, value_text FROM public.app_settings WHERE key = 'messages_nudge_last_run_v1';
```

After the first morning, the second query shows that morning's summary.
