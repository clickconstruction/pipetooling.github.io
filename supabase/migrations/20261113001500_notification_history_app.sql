SET lock_timeout = '3s';

-- A notice shown in the app only (docs/migrations/20261113001500_notification_history_app.md).
--
-- When a developer saves a conversation out of a teammate's mailbox onto a job through the dev seat, the mailbox's
-- owner is told in the app: one notification_history row of their own, read on the Dashboard and under Settings →
-- Activity logs. Nothing is pushed and nothing is emailed, by the owner's choice (2026-11-12: "In the app only").
-- The channel check allowed email, push, both and held; none of those is true of such a row, so it now allows app.
-- No new table, so no fences. Idempotent: a second run leaves the same constraint.

ALTER TABLE public.notification_history
  DROP CONSTRAINT IF EXISTS notification_history_channel_check;
ALTER TABLE public.notification_history
  ADD CONSTRAINT notification_history_channel_check
  CHECK (channel = ANY (ARRAY['email'::text, 'push'::text, 'both'::text, 'held'::text, 'app'::text]));

COMMENT ON COLUMN public.notification_history.channel IS
  'email, push or both: how the person was reached. held (v2.6029, punch list #141): a push not sent because the person was outside their Push me hours; the row is what the Dashboard lists as what waited. app: a notice shown in the app only, never pushed or emailed (a save from the person''s mail made by someone else).';
