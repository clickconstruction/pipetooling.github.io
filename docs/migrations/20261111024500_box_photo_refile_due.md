# 20261111024500 — box_photo_refile_due (v2.6915)

Materials on site (punch list #297, the engine): a box photo's Drive file follows any change of the photo's job. v2.6885 gave `photo-save` an ask that moves a job's filed box photos into the folder the job's photos land in, made by the dev seat after `apply_materials_move`. A whole-job combine changes a photo's job by the same rule (`on_site_carry_job`) and nothing asked for it, and an ask that failed or was cut short was never finished. This is the counter tickets' shape ([`20261109190000`](./20261109190000_counter_tickets.md)): the database marks the row, and the sweep that already runs moves what is marked.

1. **`job_box_photos.refile_due_at timestamptz`**, nullable, with the partial index `job_box_photos_refile_due_idx` on the rows that carry it. Null when the file is where it belongs or the photo was never filed; the time the job changed when the file has to follow; a day later after a try that was held, whose reason sits in `fail_why`.
2. **`job_box_photo_job_changed()`** with the `BEFORE UPDATE OF job_id` trigger `job_box_photos_job_changed`: when a row's `job_id` changes and it has a `drive_file_id`, `refile_due_at` becomes `now()` and `fail_why` is cleared, so the new job's try starts clean. A photo still waiting in the bucket is left alone: the sweep files it for the row's job. `SECURITY INVOKER`; it writes only the row being updated. `EXECUTE` is revoked from `PUBLIC`, `anon` and `authenticated`, since nothing calls it but the trigger.
3. **The `photo-save` cron**, re-scheduled with every earlier clause and an eleventh: `EXISTS (… job_box_photos WHERE refile_due_at IS NOT NULL AND refile_due_at <= now())`. A held row, due a day on, does not wake the cron until then.

`dev_on_site_move_job`'s dry run does the move and unwinds it, so the mark is unwound with it; `supabase/tests/on_site_move` holds that, that a filed photo is due after the apply and that a waiting one is not.

Additive and idempotent. `ALTER TABLE … ADD COLUMN` (nullable, no default) and `CREATE OR REPLACE TRIGGER` each take a brief lock on `job_box_photos`, a small table the crews write a row at a time; the file starts with `SET lock_timeout = '3s'`. Nothing is backfilled: no filed photo is out of place today (the one move applied on prod before v2.6885 was re-filed by hand on 2026-11-11).

**Release order**: push this, then deploy `photo-save` (it reads the new column), then `dev-mcp` (its reply's words). The types PR follows the push.
