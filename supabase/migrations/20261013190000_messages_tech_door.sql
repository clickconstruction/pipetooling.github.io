-- Residential build, R5's SQL (v2.5419; helper 8, directed by customer-comunication): the tech's door into Messages,
-- how long a tech holds a reply, the office's wait and hours, and a push read back by its line.
--
--   * messages_tech_team(): the field roles that message a customer from Job Mode, primary and helpers. The client's copy
--     is MESSAGES_TECH_TEAM in src/lib/gc/access.ts; access.test.ts fails when they differ. A subcontractor stays out
--     until R8 · 12.
--   * messages_tech_can_read(p_contact_id): a tech reads a customer's, a lead's or a sub's thread while dispatched to
--     (job_schedule_blocks) or clocked on (clock_sessions) one of its jobs, this week or last, Monday to Sunday in
--     Chicago. Its jobs are the Pipeline jobs tied to it (contact_jobs) and its customer's jobs (jobs_ledger). A trade
--     partner's or an architect's thread is never a tech's.
--   * contacts_tech_read, messages_tech_read: SELECT policies on that check. A tech reads no line marked office only.
--     Billing is not a column on messages: the money lines come from other tables with the office's own reads, and
--     Job Mode's thread leaves them out by its kernel's rule. A tech writes nothing here; a text from Job Mode goes
--     through quo-send as the service role.
--   * messages.office_only: a team note only the office reads. Nothing writes it yet; R5's screens add the tick, and
--     a note written today stays false.
--   * contacts.has_until: when the tech's hold on a reply ends (messages/hasRule.ts), beside has_user_id.
--     contacts_has_how_known is left as it is.
--   * app_settings messages_office_wait_minutes (15) and messages_office_hours_v1, each changed by the owner or a dev
--     through its own UPDATE policy, as the Quo seats beside them on Settings → Phone and texts are.
--   * notification_history.message_id: the line a push was for, so messages-notify never pushes a line twice
--     (messages/notifyRule.ts).
--
-- No new table, so no fences. Idempotent: a second run changes nothing.

SET lock_timeout = '3s';

-- ---------- who has a reply, until when ----------

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS has_until timestamptz;
COMMENT ON COLUMN public.contacts.has_until IS
  'When the rule''s hold on a reply ends (R5, messages/hasRule.ts): the tech who texted has it until then, then the office. Null: no end.';
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_has_until_held;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_has_until_held CHECK (has_until IS NULL OR has_user_id IS NOT NULL) NOT VALID;
ALTER TABLE public.contacts VALIDATE CONSTRAINT contacts_has_until_held;
GRANT UPDATE (has_until) ON TABLE public.contacts TO authenticated;

-- ---------- a team note only the office reads ----------

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS office_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.messages.office_only IS
  'A team note only the office reads (R5): the tech''s door (messages_tech_read) never shows it. Only a team line carries it.';
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_office_only_team;
ALTER TABLE public.messages ADD CONSTRAINT messages_office_only_team CHECK (NOT office_only OR direction = 'team') NOT VALID;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_office_only_team;
GRANT INSERT (office_only), UPDATE (office_only) ON TABLE public.messages TO authenticated;

-- ---------- the tech's door ----------

CREATE OR REPLACE FUNCTION public.messages_tech_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('primary', 'helpers')
  );
$$;

COMMENT ON FUNCTION public.messages_tech_team() IS
  'Messages, R5 (v2.5419): the field roles that message a customer from Job Mode, primary and helpers. Change the audience here, never in a policy. The client''s copy is MESSAGES_TECH_TEAM in src/lib/gc/access.ts; access.test.ts fails when they differ.';

REVOKE EXECUTE ON FUNCTION public.messages_tech_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messages_tech_team() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.messages_tech_can_read(p_contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH c AS (
    SELECT ct.id, coalesce(ct.customer_id, ccp.customer_id) AS customer_id
    FROM public.contacts ct
    LEFT JOIN public.customer_contact_persons ccp ON ccp.id = ct.customer_contact_person_id
    WHERE ct.id = p_contact_id AND ct.kind IN ('customer', 'lead', 'sub')
  ),
  span AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date - 7 AS first_day,
           date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date + 6 AS last_day
  ),
  jobs AS (
    SELECT cj.jobs_ledger_id AS job_id FROM public.contact_jobs cj JOIN c ON cj.contact_id = c.id WHERE cj.jobs_ledger_id IS NOT NULL
    UNION
    SELECT jl.id FROM public.jobs_ledger jl JOIN c ON jl.customer_id = c.customer_id
  )
  SELECT public.messages_tech_team() AND EXISTS (
    SELECT 1 FROM jobs j CROSS JOIN span s
    WHERE EXISTS (
        SELECT 1 FROM public.job_schedule_blocks b
        WHERE b.job_id = j.job_id AND b.assignee_user_id = auth.uid() AND b.work_date BETWEEN s.first_day AND s.last_day
      )
      OR EXISTS (
        SELECT 1 FROM public.clock_sessions k
        WHERE k.job_ledger_id = j.job_id AND k.user_id = auth.uid() AND k.revoked_at IS NULL
          AND k.work_date BETWEEN s.first_day AND s.last_day
      )
  );
$$;

COMMENT ON FUNCTION public.messages_tech_can_read(uuid) IS
  'Messages, R5 (v2.5419): whether the signed-in tech (messages_tech_team) reads this contact''s thread: a customer, lead or sub whose Pipeline job (tied in contact_jobs, or its customer''s) the tech is dispatched to or clocked on this week or last, Monday to Sunday in Chicago.';

REVOKE EXECUTE ON FUNCTION public.messages_tech_can_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messages_tech_can_read(uuid) TO authenticated, service_role;

-- The team check runs once per statement, so the office's reads never call the per-row check.
DROP POLICY IF EXISTS contacts_tech_read ON public.contacts;
CREATE POLICY contacts_tech_read ON public.contacts FOR SELECT TO authenticated
  USING ((SELECT public.messages_tech_team()) AND public.messages_tech_can_read(id));

DROP POLICY IF EXISTS messages_tech_read ON public.messages;
CREATE POLICY messages_tech_read ON public.messages FOR SELECT TO authenticated
  USING ((SELECT public.messages_tech_team()) AND NOT office_only AND public.messages_tech_can_read(contact_id));

-- ---------- the office's wait and hours ----------

INSERT INTO public.app_settings (key, value_num)
VALUES ('messages_office_wait_minutes', 15)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value_text)
VALUES ('messages_office_hours_v1', '{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","techUntil":"17:00","emergency":null}')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_messages_office_wait ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_office_wait ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_office_wait_minutes' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_office_wait_minutes' AND public.is_master_or_dev());

DROP POLICY IF EXISTS master_or_dev_update_messages_office_hours ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_office_hours ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_office_hours_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_office_hours_v1' AND public.is_master_or_dev());

-- ---------- a push read back by its line ----------

ALTER TABLE public.notification_history ADD COLUMN IF NOT EXISTS message_id uuid;
COMMENT ON COLUMN public.notification_history.message_id IS
  'The Messages line a push was for (R5, messages/notifyRule.ts), so messages-notify never pushes a line twice. Null for every other push. No foreign key: the history outlives a line.';
CREATE INDEX IF NOT EXISTS notification_history_message_id ON public.notification_history (message_id) WHERE message_id IS NOT NULL;
