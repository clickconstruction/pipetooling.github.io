SET lock_timeout = '3s';

-- Messages, cut 5 (c): the switch that lets the office text from the company number, Settings → Phone and texts →
-- Send texts. quo-send and the send window held texts back on a missing secret and a constant in the app; this is the
-- owner's switch instead, one app_settings row written the way the cards beside it write theirs (Quo's seats,
-- 20261013040000; Read bids@, 20261013080000): a plain update the row's own policy allows, so a policy or a missing row
-- says so instead of passing quietly.
--
--   * app_settings messages_texts_on_v1: 'true' lets a person's text and the app's reminder go; anything else, 'false'
--     as it ships, holds them. Every signed-in user reads app_settings already, so the send window reads it as the
--     person; quo-send's shared sendText reads it as the service role before every such text.
--   * The app's answer to HELP or INFO and the one confirmation of a stop go either way: each answers the person's own
--     keyword, and the carriers' rules expect it.
--   * Only the owner or a dev changes it (is_master_or_dev()), keyed to this row alone.
--
-- No table is made, so no fence is added. Idempotent: the row is inserted only when missing, and the policy is
-- dropped and made again.

INSERT INTO public.app_settings (key, value_text)
VALUES ('messages_texts_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_messages_texts_on ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_texts_on ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_texts_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_texts_on_v1' AND public.is_master_or_dev());
