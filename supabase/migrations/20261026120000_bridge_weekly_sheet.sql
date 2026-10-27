SET lock_timeout = '3s';

-- The weekly send of the Bridge's Monday sheet (v2.5883, bridge-weekly-sheet; docs/EDGE_FUNCTIONS.md → bridge-weekly-sheet).
--   * The switch, app_settings bridge_weekly_sheet_on_v1, ships 'false'. A dev turns it on or off from the Bridge's Monday
--     sheet (its own UPDATE policy, the shape of messages_reply_push_on_v1's; dev only, since the Bridge is).
--   * The last run, bridge_weekly_sheet_last_run_v1, is written by the function as the service role and read by the page;
--     seeded empty so the page's read finds a row.
--   * A cron row, bridge-weekly-sheet, Mondays at 11:00 and 12:00 UTC (6 AM Central in summer and in winter; the function
--     runs only the tick that is 6 AM): POST /functions/v1/bridge-weekly-sheet with {} and the cron secret (Vault PROJECT_URL
--     and CRON_SECRET, as the other crons read them), only while the switch is on. Unscheduled first if it exists, so a
--     second push leaves one row.
-- No table, so no fences. Pushed after the function is deployed, so the cron never posts to a function that is not there.

-- ---------- the switch and the last run ----------

INSERT INTO public.app_settings (key, value_text)
VALUES ('bridge_weekly_sheet_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value_text)
VALUES ('bridge_weekly_sheet_last_run_v1', NULL)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS dev_update_bridge_weekly_sheet_on ON public.app_settings;
CREATE POLICY dev_update_bridge_weekly_sheet_on ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'bridge_weekly_sheet_on_v1' AND public.is_dev())
  WITH CHECK (key = 'bridge_weekly_sheet_on_v1' AND public.is_dev());

-- ---------- the cron ----------

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bridge-weekly-sheet';

SELECT cron.schedule(
  'bridge-weekly-sheet',
  '0 11,12 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/bridge-weekly-sheet',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'bridge_weekly_sheet_on_v1' AND value_text = 'true');
  $$
);
