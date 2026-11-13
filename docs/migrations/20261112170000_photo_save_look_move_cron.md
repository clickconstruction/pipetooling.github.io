# 20261112170000_photo_save_look_move_cron.sql (2026-11-12, v2.7005)

The photo sweep's cron calls for a look whose Drive folder is due a move (punch list #319 PR 6). When a job is made from a look whose files are already in Drive, the sweep moves the look's folder under the job's own **Customer supplied photos**. The cron only wakes the sweep while one of its listed sources has something waiting (the lesson of v2.7025), so the move gets a clause.

## What it does

Unschedules `photo-save` and schedules it again, every five minutes as before, with **one more clause** after the thirteen `20261112160000_photo_save_looks_cron.sql` held, each written again unchanged: a look with a job and a Drive folder and no move stamped (`first_looks.drive_job_folder_at`), under 90 days old.

## Why a file of its own

Both this and `20261112160000` schedule the same cron. A database built from the files in order must end on the fullest list, so this one is stamped after it, though it ships with `20261112130000_first_look_job.sql`.

## Release order

Merge, `bash scripts/db-push.sh`, then `supabase functions deploy photo-save`. Any order is safe.

## Verify

Read-only on prod after the push: `select command like '%drive_job_folder_at%' from cron.job where jobname = 'photo-save'` reads true, and `select count(*) from cron.job where jobname = 'photo-save'` reads 1.
