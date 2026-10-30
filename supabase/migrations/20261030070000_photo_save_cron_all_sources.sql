SET lock_timeout = '3s';

-- The photo-save cron with every source's clause (a checklist per stage, punch list #164 PR 3). The sweep files four kinds
-- of photo, and the cron calls it only while one of them waits, one EXISTS clause each: a job's tick is on (the Messages
-- pass), a box photo waits (#209), a saved report's photo waits (#189), a checklist photo waits (#164).
--
-- 20261029210000_stage_checklists.sql scheduled it with the checklist clause. 20261029220000_report_photos.sql, written
-- beside it the same evening, re-scheduled it an hour later with the report clause and without the checklist one, so a
-- checklist photo alone would wait in its bucket until some other photo woke the sweep. This writes all four again; a
-- later source re-schedules it with every clause here plus its own. Unscheduled first, so a second run leaves one row
-- (20261029160000's shape). No table is made, so no house calls.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'photo-save';

SELECT cron.schedule(
  'photo-save',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/photo-save',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.photo_saves WHERE on_since IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.report_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL AND report_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.stage_checklist_answers WHERE photo_filed_at IS NULL AND photo_storage_path IS NOT NULL);
  $$
);
