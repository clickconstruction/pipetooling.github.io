# 20261121210000_license_roll_pull_cron_apprentice.sql (2026-11-21, v2.8202)

State roll, the apprentice file for our own people (punch list #411, step two; `to-dos/state-roll/`). One more pg_cron job for [`license-roll-pull`](../EDGE_FUNCTIONS.md#license-roll-pull).

## What it does

- **`license-roll-pull-pa`** at 12:50 UTC on Mondays, with `{"file": "PA"}`: five minutes after the tradesman file, so the board still gets one request at a time.

It reads `PROJECT_URL` and `CRON_SECRET` from the vault and posts with `X-Cron-Secret`, as the four jobs of `20261121141000` do.

## Why a job for a file that keeps no county

The function reads the apprentice file for our own apprentices' numbers alone, so People → Licenses can be checked against the state's record. No other apprentice is kept: the file gives no age, and an apprentice can be 16. Without the weekly job the state's date on our own apprentices would go stale.

No table, so no fence call. Safe to run twice.

## Applying it

`supabase db push`, after `license-roll-pull` is redeployed from this version. A job that fires against the older function gets a 400 naming the files it knows, and changes nothing.

## To check it

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'license-roll-pull-%' ORDER BY schedule;   -- five rows
```

## Applied

On the prod ledger, read on 2026-11-23 with the dev seat's `check_migration_ledger` during a docs catch-up. The push's own time and checks were not recorded here.
