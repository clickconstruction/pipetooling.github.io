SET lock_timeout = '3s';

-- weekly_money Report Subscriptions stream (v2.1448) — WEEKLY_MONEY_PLAN.md
-- Phase 5, steps 2–3 of the docs/REPORT_SUBSCRIPTIONS.md checklist. Requests
-- table + cron dispatcher for scheduled sends of the Weekly Money Movement
-- report. The payload RPC already exists (get_weekly_money_movement_payload,
-- v2.1442 — service-role callable; the dispatcher reuses it, so there is no
-- client/SQL mirror to fidelity-verify).
--
-- Recipients are INTERNAL and restricted to dev/controller — the email
-- carries wage-derived job costs (tighter than weekly_movement's office
-- cohort, matching the report's own access gate).

CREATE TABLE IF NOT EXISTS public.weekly_money_email_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  send_at timestamptz NOT NULL,
  repeat_weekly boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  attempts int NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.weekly_money_email_requests IS
  'Requested sends of the Weekly Money Movement report email (v2.1448, weekly_money Report Subscriptions stream). Dev/controller insert; the weekly-money-email-dispatch edge function (pg_cron */5) processes due rows — the report covers the PREVIOUS complete Central week, rebuilt at send time via get_weekly_money_movement_payload. Recipients restricted to dev/controller (wage-derived data).';

CREATE INDEX IF NOT EXISTS idx_weekly_money_email_requests_due
  ON public.weekly_money_email_requests (send_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.weekly_money_email_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dev and controller insert weekly money email requests" ON public.weekly_money_email_requests;
CREATE POLICY "Dev and controller insert weekly money email requests" ON public.weekly_money_email_requests
  FOR INSERT WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND (
      public.is_dev()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid()) AND u.role = 'controller'
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.users r
      WHERE r.id = recipient_user_id AND r.role IN ('dev', 'controller')
    )
  );

DROP POLICY IF EXISTS "Creators and devs read weekly money email requests" ON public.weekly_money_email_requests;
CREATE POLICY "Creators and devs read weekly money email requests" ON public.weekly_money_email_requests
  FOR SELECT USING (requested_by = (SELECT auth.uid()) OR public.is_dev());

DROP POLICY IF EXISTS "Creators cancel own unsent weekly money email requests" ON public.weekly_money_email_requests;
CREATE POLICY "Creators cancel own unsent weekly money email requests" ON public.weekly_money_email_requests
  FOR DELETE USING (
    (requested_by = (SELECT auth.uid()) AND sent_at IS NULL) OR public.is_dev()
  );

-- No client UPDATE policy — only the service-role edge function stamps rows.

-- ── pg_cron: dispatch every 5 minutes ────────────────────────────────────────

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'weekly-money-email-dispatch';

SELECT cron.schedule(
  'weekly-money-email-dispatch',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/weekly-money-email-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
