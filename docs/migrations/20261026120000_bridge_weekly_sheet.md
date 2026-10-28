# 20261026120000_bridge_weekly_sheet.sql (2026-10-26, v2.5883)

The weekly send of the Bridge's Monday sheet, `bridge-weekly-sheet` (`docs/EDGE_FUNCTIONS.md` → bridge-weekly-sheet): its switch, the row its last run is kept in, and its cron. Pushed after the function is deployed, so the cron never posts to a function that is not there.

## What it does

1. **Seeds the switch**, `app_settings` `bridge_weekly_sheet_on_v1`, as `'false'` (`ON CONFLICT DO NOTHING`), and **the last run's row**, `bridge_weekly_sheet_last_run_v1`, empty: the function writes it as the service role after each run and the Bridge's card reads it.
2. **Lets a dev change the switch**: `dev_update_bridge_weekly_sheet_on`, a key-scoped UPDATE policy of the shape of `master_or_dev_update_messages_reply_push_on`, held to `public.is_dev()` since the Bridge is dev only. Reads stay as `app_settings` reads are for everyone signed in.
3. **Schedules** `bridge-weekly-sheet` at `0 11,12 * * 1` (Mondays, 11:00 and 12:00 UTC: 6 AM Central in summer and in winter; the function runs only the tick that is 6 AM). It runs `net.http_post` to `PROJECT_URL` + `/functions/v1/bridge-weekly-sheet` with the `X-Cron-Secret` header and `{}`, both secrets from `vault.decrypted_secrets`, **only while the switch reads `'true'`** (the `WHERE EXISTS` on the statement, as `messages-reply-push`'s). Unscheduled first, so a second push leaves one job.

## Safety

- `SET lock_timeout = '3s'` first.
- No table, so no fences. Two small inserts that do nothing on conflict, one policy, one cron row.
- Idempotent: the inserts skip, the policy is dropped and recreated, the cron is unscheduled and rescheduled.
- Nothing mails on push: the switch ships off, the cron posts only while it is on, and the function checks the switch again.

## Verify on prod (read only)

```sql
SELECT key, value_text FROM public.app_settings WHERE key IN ('bridge_weekly_sheet_on_v1', 'bridge_weekly_sheet_last_run_v1');
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'bridge-weekly-sheet';
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.app_settings'::regclass AND polname = 'dev_update_bridge_weekly_sheet_on';
```

After the first Monday with the switch on, the second row holds that morning's run.

**Applied** to prod by 2026-10-28: `npm run check:migration-drift` read 994 local files and 994 remote versions, fully applied (read in the docs pass after #6245); `check:edge-drift` read every one of the 169 functions deployed and current the same day, `bridge-weekly-sheet` among them. No types to regenerate: a setting, a policy and a cron row.
