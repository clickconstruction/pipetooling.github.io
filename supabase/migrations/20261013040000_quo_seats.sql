SET lock_timeout = '3s';

-- Messages, cut 5 (b): Quo's seats, kept in Settings → Phone and texts instead of the QUO_SEATS secret.
--
-- A seat is one of Quo's workspace users, by Quo's id ("US…"), and the user of ours who answers on it. quo-send texts
-- as the sender's own seat when they have one, and quo-webhook names a call or a text by whose seat it rang. The map
-- was a function secret until the Settings card could hold it; this is its home now, one app_settings row, written
-- the way the card next to it writes Who gets a new message (cut 2, messages_assign_rule_v1): a plain update the row's
-- own policy allows, so a policy or a missing row says so instead of passing quietly.
--
--   * app_settings messages_quo_seats_v1: {"US…": "<users.id>", …}, empty to start. Every signed-in user reads
--     app_settings already, so the team sees which seat is whose; Quo's user ids are not secrets.
--   * Only the owner or a dev changes it (is_master_or_dev()), keyed to this row alone.
--   * quo-send and quo-webhook read it as the service role, past RLS, and fall back to the QUO_SEATS secret while
--     the row is empty.

INSERT INTO public.app_settings (key, value_text)
VALUES ('messages_quo_seats_v1', '{}')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_messages_quo_seats ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_quo_seats ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_quo_seats_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_quo_seats_v1' AND public.is_master_or_dev());
