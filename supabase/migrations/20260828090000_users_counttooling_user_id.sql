SET lock_timeout = '3s';

-- CT↔PT user bridge, join key (v2.2434). PipeTooling is the single system of record for
-- people; CountTooling seats are provisioned/retired over the ct-bridge → manage-user
-- edge-function pair. This column is the durable join: the CountTooling auth.users uuid
-- for this person, filled when PT creates (or looks up) their CT seat. NULL = no CT seat
-- known. It replaces the email-string convention — emails change, uuids don't. Drift
-- between the two rosters is caught by the weekly audit, not prevented by sync machinery.
--
-- Not a privileged column: the users_guard_privileged_columns trigger fires only on
-- role/read_only/archived_at, so dev sessions and the service-role bridge write freely.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS counttooling_user_id uuid NULL;

COMMENT ON COLUMN public.users.counttooling_user_id IS
  'CountTooling auth.users uuid for this person (CT↔PT bridge join key). NULL = no CT seat known. Written by the ct-bridge flows; audited weekly for drift.';
