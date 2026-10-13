SET lock_timeout = '3s';

-- Messages, cut 5: the two app_settings rows of the morning run of the reminders the app sends itself
-- (messages-nudge-dispatch; to-dos/gc-mode/messages/BUILD_PLAN.md → Cut 5, and section 7's decision 3: per step, off
-- until the owner turns it on). The run's reads are src/lib/flows/nudgeRunInputs.ts; its planner is nudgeDispatch.ts.
--
--   * app_settings messages_nudge_app_sends_v1: the owner's switch, {"<kind>": {"<step id>": true}}. Only a true turns
--     a step's reminder on; anything else is off, and the row starts as {}, so every step is off. The step ids nest
--     under their kind because an id is unique only within its kind's flow: the sub flow brings asked, onsite and yes,
--     which the customer flow already has, and a flat key would turn both on at once. Only the owner or a dev changes
--     it (is_master_or_dev()), keyed to this row alone, the way messages_quo_seats_v1 is written.
--   * app_settings messages_nudge_last_run_v1: the newest morning's summary, what went and what was kept back and why,
--     {} until the first run. The run writes it as the service role, past RLS, so it has no UPDATE policy of its own:
--     past the run, only a dev changes it, under the table's "Devs can manage app settings". Every signed-in user
--     reads app_settings already.

INSERT INTO public.app_settings (key, value_text)
VALUES ('messages_nudge_app_sends_v1', '{}'), ('messages_nudge_last_run_v1', '{}')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_messages_nudge_app_sends ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_nudge_app_sends ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_nudge_app_sends_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_nudge_app_sends_v1' AND public.is_master_or_dev());
