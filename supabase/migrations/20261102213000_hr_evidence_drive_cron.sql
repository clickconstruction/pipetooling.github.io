SET lock_timeout = '3s';

-- The hr-evidence-drive sweep (the People → Paperwork spike, v2.6393): every ten minutes, six past the folder sweep's
-- slot, while a piece of evidence has a file not yet in Drive. A record is filed the moment it is kept, from the dev's
-- session; the cron catches the ones Drive refused or the function missed (the People folder set later, a deploy in
-- between). The clause reads person_file_evidence (20261102210000_person_file_evidence.sql, v2.6392): push that one first.
-- Unscheduled first, so a second run leaves one row. No table is made, so no house calls.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'hr-evidence-drive';

SELECT cron.schedule(
  'hr-evidence-drive',
  '6,16,26,36,46,56 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/hr-evidence-drive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.person_file_evidence WHERE filed_at IS NULL);
  $$
);
