# 20261121141000_license_roll_pull_cron.sql (2026-11-21, v2.8164)

State roll, the weekly pull (punch list #411, step one; `to-dos/state-roll/`). Four pg_cron jobs that post the edge function [`license-roll-pull`](../EDGE_FUNCTIONS.md#license-roll-pull) once for each of the plumbing board's files.

## What it does

- **`license-roll-pull-rmp`** at 12:30 UTC on Mondays, with `{"file": "RMP"}`.
- **`license-roll-pull-mp`** at 12:35, with `MP`.
- **`license-roll-pull-jp`** at 12:40, with `JP`.
- **`license-roll-pull-tp`** at 12:45, with `TP`.

Each reads `PROJECT_URL` and `CRON_SECRET` from the vault and posts with `X-Cron-Secret`, as the permit pull's job does.

## Rules it settles

- **One file a job, five minutes apart.** The function reads one file a call to stay inside the edge's CPU limit, and the board gets one request at a time.
- **Mondays.** 12:30 UTC is 6:30 AM Central in winter and 7:30 in summer, before the office opens. The board refreshes its two largest files about weekly, so a daily pull would read the same file six days in seven.
- **No apprentice job.** The apprentice file is read only for our own people's numbers, which is step two.

No table, so no fence call. Safe to run twice: each job is unscheduled before it is scheduled.

## Applying it

`supabase db push`, after `20261121140000_license_roll` is pushed and `license-roll-pull` is deployed. A job that fires before the function is deployed gets a 404 from the edge and changes nothing.

## To check it

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'license-roll-pull-%' ORDER BY 1;   -- four rows
SELECT file, started_at, rows_seen, rows_kept, added, changed, gone, error
  FROM public.license_roll_pulls ORDER BY started_at DESC LIMIT 8;                                   -- after a Monday
```
