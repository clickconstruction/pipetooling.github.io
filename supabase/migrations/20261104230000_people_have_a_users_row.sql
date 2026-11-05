SET lock_timeout = '3s';

-- The schema says every People record has a users row (punch list #265, v2.6530, PR 2 of 3).
--
-- Since #260 every person is a users row: add_worker (20261104200000) makes one for every new record and the
-- backfill (20261104210000) linked every record it could, leaving the two whose name a login already carries for
-- the desk. people.account_user_id stayed nullable because the key was ON DELETE SET NULL and the combine nulled a
-- source's account. Both are gone: the combine refuses two people who each have a users row (v2.6529), and here
-- the key becomes ON DELETE RESTRICT — a users row with a People record is archived, never deleted, and invite-user
-- re-invites a pending invite on the same id instead of deleting the row.
--
--   * people_needs_users_row (BEFORE INSERT OR UPDATE OF account_user_id): a signed-in write — every client path,
--     and add_worker's own insert, which always carries the row — may not leave account_user_id NULL. A write with
--     no caller (the service role, a migration, a bed's fixture) may: seven whole-schema beds seed roster-only
--     records as fixtures for other tables, and the two records the backfill skipped stand until the desk links
--     them. A NOT NULL or a CHECK would hold those too; the trigger holds the app, which is where a stray would be
--     made. Once the count on People → Users reads zero and the beds seed linked records, a one-line migration
--     makes the column NOT NULL and the roster view a plain join.
--   * people_account_user_id_fkey: ON DELETE RESTRICT.
--
-- No table is created, so no fence calls. Idempotent.

CREATE OR REPLACE FUNCTION public.people_needs_users_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.account_user_id IS NULL AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'A person is a users row: add them with add_worker, which makes the row and the record together.' USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.people_needs_users_row() IS
  'Every People record a signed-in write makes or changes carries its users row (punch list #265, v2.6530); a write with no caller (service role, migration, bed) may leave it NULL. The step before people.account_user_id NOT NULL.';

DROP TRIGGER IF EXISTS people_needs_users_row ON public.people;
CREATE TRIGGER people_needs_users_row
  BEFORE INSERT OR UPDATE OF account_user_id ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.people_needs_users_row();

ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_account_user_id_fkey;
ALTER TABLE public.people
  ADD CONSTRAINT people_account_user_id_fkey FOREIGN KEY (account_user_id) REFERENCES public.users(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.people VALIDATE CONSTRAINT people_account_user_id_fkey;
