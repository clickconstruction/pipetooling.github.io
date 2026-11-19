SET lock_timeout = '3s';

-- ===============================================================================================================
-- A watch tells the people on its list.
--
-- person_watches keeps who to tell (tell_user_ids). This file gives the telling its ground:
--   person_watch_notices      one row a notice sent: the watch, the notice's key, its words, who was told
--   watch-notify-dispatch     the cron job that calls the function of that name every five minutes
--
-- The function writes a notice's key here BEFORE its push goes, and (watch_id, key) is unique, so two runs never
-- send one notice twice. Devs alone read the table, as they alone read a watch. The service role writes it.
-- ===============================================================================================================

CREATE TABLE IF NOT EXISTS public.person_watch_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id uuid NOT NULL REFERENCES public.person_watches(id) ON DELETE CASCADE,
  -- started:<day>, evening:<day>, or outside:<the act's row id>.
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('started', 'outside', 'evening')),
  day date NOT NULL,
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 300),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 1000),
  told uuid[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_watch_notices_once UNIQUE (watch_id, key)
);
COMMENT ON TABLE public.person_watch_notices IS 'A notice a watch sent to the people on its list: the watch, the key that makes it once only (started:<day>, evening:<day>, outside:<act id>), its words and who was told. Written by the watch-notify-dispatch function with the service role, before its push goes. Dev-only by RLS.';

ALTER TABLE public.person_watch_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.person_watch_notices FROM anon, authenticated;
GRANT SELECT ON TABLE public.person_watch_notices TO authenticated;
GRANT ALL ON TABLE public.person_watch_notices TO service_role;
DROP POLICY IF EXISTS person_watch_notices_select ON public.person_watch_notices;
CREATE POLICY person_watch_notices_select ON public.person_watch_notices FOR SELECT TO authenticated USING (public.is_dev());

-- Every five minutes, two minutes off the other dispatch jobs. The function does nothing when no live watch has
-- anyone on its list, so the job costs one small read while nobody is watched.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'watch-notify-dispatch';

SELECT cron.schedule(
  'watch-notify-dispatch',
  '2-59/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/watch-notify-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
