# 20261112160000_photo_save_looks_cron.sql (2026-11-12, v2.7025)

The photo sweep's cron calls for a First look's files (punch list #319). PR 2 (v2.7001) gave `photo-save` a twelfth source and left it off the list of things that wake the sweep, so a look's files waited for some other source to wake it. The live walk of 2026-11-12 found it.

## What it does

Unschedules `photo-save` and schedules it again, every five minutes as before, with **two more clauses** after the eleven `20261111024500_box_photo_refile_due.sql` held, each of those written again unchanged:

- **A look's file** that is finished, not removed and not in Drive, under 30 days old, and never tried or last tried over 15 minutes ago (`first_look_files.drive_tried_at`).
- **A picture or a video texted in since the ask** by a customer an open look was asked of, kept by us and in Drive nowhere yet, for looks under 14 days old.

No table, no function, no policy.

## Why the two bounds

A file that cannot file yet (a caller who is not a customer) is tried every quarter hour and stops waking the sweep after a month. A video part way through its copy is not stamped as tried (`photo-save`, the same PR), so the next run five minutes on picks it up.

## Release order

Merge, `bash scripts/db-push.sh`, then `supabase functions deploy photo-save`. Any order is safe.

## Verify

Read-only on prod after the push: `select command like '%first_look_files%' from cron.job where jobname = 'photo-save'` reads true, and `select count(*) from cron.job where jobname = 'photo-save'` reads 1.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659); types regenerated in #7800.
