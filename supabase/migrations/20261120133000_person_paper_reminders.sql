SET lock_timeout = '3s';

-- Documents → Agreements, reminders by email for a staff or sub paper (punch list #376, What is left, row 1).
--
-- A job's contract gets three reminders, three days apart (remind-job-contracts, v2.2690). A person's paper has had
-- only a prompt on the person's own Dashboard. This is the ground for the same three: four columns on the paper's own
-- row, one Settings switch for all that starts off, and the timed call.
--
--   1. person_contract_documents gains reminders_enabled (the paper's own switch, on), reminder_count (0 to 3),
--      next_reminder_at and last_reminded_at. The address a reminder goes to is signer_email, which a send has kept
--      since v2.7986.
--   2. A partial index on next_reminder_at for the papers that are out, which the timed function reads each hour.
--   3. app_settings person_paper_reminders_v1, seeded '0'. The owner and a dev may change that one key. A send reads
--      it: a paper sent while it is off gets no next_reminder_at, so turning it on reaches no paper already out.
--   4. pg_cron calls remind-person-papers hourly at :37, the way job-contract-reminders is called at :23.
--
-- No table is created, so there are no fence calls: the read-only, twin and archived fences on both tables stand, and
-- the paper's own switch is written through the table's existing policies (the four office roles).
-- Idempotent.

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

COMMENT ON COLUMN public.person_contract_documents.reminders_enabled IS 'The paper''s own switch for reminders by email. On unless the office turns it off on the paper''s line.';
COMMENT ON COLUMN public.person_contract_documents.reminder_count IS 'Reminders emailed since the paper was last sent, 0 to 3. A send starts it again.';
COMMENT ON COLUMN public.person_contract_documents.next_reminder_at IS 'When the next reminder is due. Null when none is: the Settings switch was off at the send, the paper''s switch is off, the link was handed over, or all three went.';
COMMENT ON COLUMN public.person_contract_documents.last_reminded_at IS 'When the last reminder was emailed.';

ALTER TABLE public.person_contract_documents DROP CONSTRAINT IF EXISTS person_contract_documents_reminder_count;
ALTER TABLE public.person_contract_documents
  ADD CONSTRAINT person_contract_documents_reminder_count CHECK (reminder_count BETWEEN 0 AND 3);

CREATE INDEX IF NOT EXISTS person_contract_documents_reminder_due
  ON public.person_contract_documents (next_reminder_at)
  WHERE status = 'sent' AND next_reminder_at IS NOT NULL;

-- The Settings switch for all. It starts off: nobody is emailed by the robot until the owner says so.
INSERT INTO public.app_settings (key, value_text)
VALUES ('person_paper_reminders_v1', '0')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_person_paper_reminders ON public.app_settings;
CREATE POLICY master_or_dev_update_person_paper_reminders
  ON public.app_settings FOR UPDATE TO authenticated
  USING (key = 'person_paper_reminders_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'person_paper_reminders_v1' AND public.is_master_or_dev());

-- The timed call. The function answers { skipped: 'off' } while the switch is off, so scheduling it sends nothing.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'person-paper-reminders';

SELECT cron.schedule(
  'person-paper-reminders',
  '37 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/remind-person-papers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
