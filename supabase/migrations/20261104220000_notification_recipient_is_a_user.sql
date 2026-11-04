SET lock_timeout = '3s';

-- A notification's recipient is a person, not a login (punch list #260, v2.6519, PR 5 of 5).
--
-- Of the twenty-four public foreign keys to auth.users left after 20261104190000 dropped users_id_fkey, twenty-three
-- name an actor — created_by, updated_by, dismissed_by, the row's own user — which a worker who never signs in never
-- fills. One names a receiver: notification_history.recipient_user_id. A notice to a person with no login (their hours
-- approved, say) was refused by the key with 23503 (the spike's scenario F). The key now points at public.users, where
-- every person is, and every fan-out skips a recipient with no login or no address before it writes a row at all.
-- The orphan-cleaning ON DELETE CASCADE stands: deleting a users row still takes its notices.
--
-- NOT VALID then VALIDATE: the add takes a brief lock and the scan runs without blocking writes. Every existing row
-- points at a login that is also a users row, so the validation passes. No table is created, so no fence calls.

ALTER TABLE public.notification_history DROP CONSTRAINT IF EXISTS notification_history_recipient_user_id_fkey;
ALTER TABLE public.notification_history
  ADD CONSTRAINT notification_history_recipient_user_id_fkey
  FOREIGN KEY (recipient_user_id) REFERENCES public.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.notification_history VALIDATE CONSTRAINT notification_history_recipient_user_id_fkey;

COMMENT ON CONSTRAINT notification_history_recipient_user_id_fkey ON public.notification_history IS
  'The recipient is a public.users row (a person, with or without a login) since v2.6519; it pointed at auth.users before. Cascades with the row.';
