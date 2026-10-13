SET lock_timeout = '3s';

-- Messages, residential R5's push, PR 3 of 3 (to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md on branch spike/gc-mode;
-- the body is v2.5479's messages-notify, deployed by the lead): the minute sweep that pushes a customer's, a lead's or a
-- sub's reply to whoever has it, behind a switch that ships off.
--
--   * The switch, app_settings messages_reply_push_on_v1, ships 'false'. The owner or a dev turns it on or off (its own
--     UPDATE policy, the shape of gmail_sync_on_v1's), after the live test: a text from the owner's phone, with the
--     tech's push and the office's after the wait.
--   * A cron row, messages-reply-push, every minute: POST /functions/v1/messages-notify with {"sweep": true} and the cron
--     secret (Vault PROJECT_URL and CRON_SECRET, uppercase, as gmail-sync's and photo-save's crons are scheduled). It
--     posts only while the switch is on, so nothing calls the function until then. Unscheduled first if it exists, so
--     a second run leaves one row.
-- No table, so no fences.

-- ---------- the switch ----------

INSERT INTO public.app_settings (key, value_text)
VALUES ('messages_reply_push_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_messages_reply_push_on ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_reply_push_on ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_reply_push_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_reply_push_on_v1' AND public.is_master_or_dev());

-- ---------- the cron ----------

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'messages-reply-push';

SELECT cron.schedule(
  'messages-reply-push',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/messages-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{"sweep": true}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'messages_reply_push_on_v1' AND value_text = 'true');
  $$
);
