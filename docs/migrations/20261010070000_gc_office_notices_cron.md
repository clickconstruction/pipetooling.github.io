# 20261010070000_gc_office_notices_cron.sql

GC mode, Owner Billing's O10b: the cron that calls `gc-office-notices` hourly (v2.5148). The plan is `to-dos/gc-mode/mockups/owner-billing-o10.md` on branch `spike/gc-mode`, whose cron SQL block is this file byte for byte but for the version. The record, the payload and the switch are O10a's (`20261010060000`).

**Why:** the function sends the office's notices each morning (bill day in two days, the architect at 3 days, the project manager at 5), and something has to call it. pg_cron does, hourly, as `bid-followup-reminders` does (`20261002160000`): the function waits for 8 AM Central itself, so the schedule needs no daylight-saving arithmetic.

## What it does

`cron.unschedule` any old `gc-office-notices` job, then `cron.schedule('gc-office-notices', '13 * * * *', …)`: a `net.http_post` to `/functions/v1/gc-office-notices` with `X-Cron-Secret`, both from Vault (`PROJECT_URL`, `CRON_SECRET`, uppercase). :13 is no other hourly job's minute (`bid-followup-reminders` :08, `ar-returned-checks-hourly` :17, `job-contract-reminders` :23).

The function does nothing while `app_settings.gc_office_notices_on_v1` is off, so the cron is safe to run before the owner turns the notices on.

## Order

Deploy `gc-office-notices` first (`supabase functions deploy gc-office-notices --no-verify-jwt`), then push this migration, so no tick finds the function missing.

## Verify after the push

Read only:
1. `SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'gc-office-notices'` gives one row, `13 * * * *`, active.
2. After the next :13, `SELECT status, return_message FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'gc-office-notices') ORDER BY start_time DESC LIMIT 1` reads `succeeded`, and the function's log answers `skipped: off` (or `before the morning` before 8 AM Central).

## Status

Cut 2026-10-09 by Helper 5 (the Owner Billing lane). The lead deploys the function, then pushes this.
