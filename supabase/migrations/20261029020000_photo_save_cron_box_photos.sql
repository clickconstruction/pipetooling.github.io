SET lock_timeout = '3s';

-- Materials on site (punch list #209, v2.6045): the photo-save sweep gains a second source, the photos of boxes a
-- crew shoots on the On site tab (job_box_photos, 20261029010000). Its cron called only while some job's Messages
-- tick was on (20261014090000); it now also calls while a box photo waits in the bucket to be filed in Drive.
-- Unscheduled first, so a second run leaves one row.

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
     OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE filed_at IS NULL AND storage_path IS NOT NULL AND fail_why IS NULL);
  $$
);
