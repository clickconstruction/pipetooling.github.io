SET lock_timeout = '3s';

-- v2.8532 — Global Reload: only a dev can send the signal.
--
-- The signal was a broadcast on the open Realtime channel `force-reload`. Anyone holding the app's public key could
-- send it, and every open copy of the app reloaded, over words a person had typed. The client now joins the PRIVATE
-- channel of the same name, which Realtime checks against the policies on realtime.messages:
--
--   hear it   anyone signed in
--   send it   a dev, and nobody else
--
-- A private channel and an open channel of one name are two channels, so a signal sent on the open one no longer
-- reaches a copy of the app that has this change. A send the policy refuses is dropped without a word.
--
-- Realtime's own service makes realtime.messages and already has row security on it (never ALTER it here: the table
-- is not ours, and the statement fails). A database with no Realtime service, a test bed's, has no such table, and
-- there the policies are skipped. With no policy nobody can join the private channel, so a skip opens nothing.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages is not in this database: the Global Reload policies were not made';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS force_reload_signed_in_hear ON realtime.messages;
  CREATE POLICY force_reload_signed_in_hear ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      (SELECT realtime.topic()) = 'force-reload'
      AND realtime.messages.extension = 'broadcast'
    );

  DROP POLICY IF EXISTS force_reload_dev_send ON realtime.messages;
  CREATE POLICY force_reload_dev_send ON realtime.messages
    FOR INSERT TO authenticated
    WITH CHECK (
      (SELECT realtime.topic()) = 'force-reload'
      AND realtime.messages.extension = 'broadcast'
      AND (SELECT public.is_dev())
    );
END $$;
