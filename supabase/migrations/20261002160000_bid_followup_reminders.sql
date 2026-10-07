SET lock_timeout = '3s';

-- The phone reminder for a bid's call-again day (v2.4427, punch list #80).
--
--   • bid_followup_reminders is the ledger of reminders sent: one row per bid and day. The edge
--     function remind-bid-followups writes the row BEFORE it pushes, and the unique key makes a
--     second hourly tick a no-op, so a call promised for a day reminds once. A day moved later
--     is a new day and reminds again.
--   • Only the function writes it (service role). The office may read it.
--   • pg_cron calls the function every hour at :08 (the job-contract-reminders precedent:
--     PROJECT_URL + CRON_SECRET from vault). The function itself waits for 8 AM office time, so
--     the schedule needs no daylight-saving arithmetic. Kill switch without unscheduling:
--     app_settings key bid_followup_reminders_disabled_v1 = '1'. Idempotent.

CREATE TABLE IF NOT EXISTS public.bid_followup_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  -- The call-again day the reminder was for (bids.next_followup_on at the time).
  due_on date NOT NULL,
  -- Who was told: the account manager, else the estimator, else whoever set the day.
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Devices the notification reached; 0 = the person has no device registered (the Dashboard still shows it).
  push_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_followup_reminders_bid_day_uniq UNIQUE (bid_id, due_on)
);

COMMENT ON TABLE public.bid_followup_reminders IS
  'v2.4427: one row per bid and call-again day a phone reminder was sent for (remind-bid-followups). The unique key is what stops a second send. Written by the service role only.';

ALTER TABLE public.bid_followup_reminders ENABLE ROW LEVEL SECURITY;

-- Read-only for the office; no INSERT / UPDATE / DELETE policy: only the service role writes.
DROP POLICY IF EXISTS bid_followup_reminders_select_office ON public.bid_followup_reminders;
CREATE POLICY bid_followup_reminders_select_office
  ON public.bid_followup_reminders FOR SELECT TO authenticated
  USING (public.is_office_staff());

REVOKE ALL ON public.bid_followup_reminders FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.bid_followup_reminders FROM authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bid-followup-reminders';

SELECT cron.schedule(
  'bid-followup-reminders',
  '8 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/remind-bid-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
