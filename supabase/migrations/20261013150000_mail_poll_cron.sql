SET lock_timeout = '3s';

-- The Docsmit train, PR 6a (docs/DOCSMIT_LIEN_RUN_PLAN.md, "Delivery drives the desk" and "Managed from Developer
-- settings"): the hourly read-back and the switches' home.
--
--   * A cron row, mail-poll, at seventeen past every hour: POST /functions/v1/mail-poll with the cron secret (Vault
--     PROJECT_URL and CRON_SECRET, uppercase, as gmail-sync's cron is scheduled). It runs only once a dev has set
--     the connection up (an app_settings docsmit_env row exists) and while docsmit_paused is not 'true', so nothing
--     calls a function that is not deployed, and the pause switch holds the poll as it holds the sends.
--   * The switches live in app_settings under docsmit_* (src/lib/mail/docsmitSettings.ts names them and fills every
--     default); only docsmit_paused is seeded here ('false'), so the parser's defaults stay the one source of truth.
--     A dev may read and write any docsmit_* row from the app, through its own policies (the shape of
--     20261013080000's gmail_sync_on_v1). Secrets never live here: they are the function's (Vault with PR 9).

INSERT INTO public.app_settings (key, value_text)
VALUES ('docsmit_paused', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS dev_update_docsmit_settings ON public.app_settings;
CREATE POLICY dev_update_docsmit_settings ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key LIKE 'docsmit\_%' AND public.is_dev())
  WITH CHECK (key LIKE 'docsmit\_%' AND public.is_dev());

DROP POLICY IF EXISTS dev_insert_docsmit_settings ON public.app_settings;
CREATE POLICY dev_insert_docsmit_settings ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (key LIKE 'docsmit\_%' AND public.is_dev());

-- Every hour at :17, while set up and not paused.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'mail-poll';

SELECT cron.schedule(
  'mail-poll',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/mail-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'docsmit_env')
    AND NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'docsmit_paused' AND value_text = 'true');
  $$
);
