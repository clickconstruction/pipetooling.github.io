SET lock_timeout = '3s';

-- v2.6029 — a push held for a person's hours (punch list #141 PR 3;
-- docs/migrations/20261028210000_notification_history_held.md).
--
-- messages-notify now holds a reply's push for a person who is outside their Push me hours (user_push_hours,
-- 20261028200000) and writes the row it would have sent with channel = 'held', never sending it, so the Dashboard's
-- Needs you line (PR 4) can list what waited. The channel check allowed email, push and both; it now allows held.
-- No new table, so no fences. Idempotent: a second run leaves the same constraint.

ALTER TABLE public.notification_history
  DROP CONSTRAINT IF EXISTS notification_history_channel_check;
ALTER TABLE public.notification_history
  ADD CONSTRAINT notification_history_channel_check
  CHECK (channel = ANY (ARRAY['email'::text, 'push'::text, 'both'::text, 'held'::text]));

COMMENT ON COLUMN public.notification_history.channel IS
  'email, push or both: how the person was reached. held (v2.6029, punch list #141): a push not sent because the person was outside their Push me hours; the row is what the Dashboard lists as what waited.';
