SET lock_timeout = '3s';

-- Materials on site (punch list #209, v2.6049): the photo-save cron calls while any box photo waits in the bucket,
-- with or without a reason on the row. 20261029020000 left out a row carrying fail_why, so a job with no Drive
-- folder yet stopped the calls for its photos; now the sweep writes the reason on the row for the office to
-- read and keeps trying each run, so setting the folder on the job is all it takes. Unscheduled first, so a
-- second run leaves one row.

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
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL);
  $$
);
