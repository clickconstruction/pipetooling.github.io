-- "Last login" (public.users.last_sign_in_at) was maintained by a client-called
-- touch_last_sign_in() RPC, fired microseconds before the post-login hard reload —
-- the fetch was aborted on page unload, so the column stayed NULL for everyone.
-- Replace with a trigger syncing auth.users.last_sign_in_at (ground truth for every
-- login mechanism: password, magic link, invite acceptance, imitate) + one-time backfill.

CREATE OR REPLACE FUNCTION public.sync_last_sign_in_at() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.users SET last_sign_in_at = NEW.last_sign_in_at WHERE id = NEW.id;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.sync_last_sign_in_at() IS 'Copies auth.users.last_sign_in_at into public.users on every login (trigger on_auth_user_signed_in). Replaces the dropped touch_last_sign_in() client RPC, whose request was aborted by the post-login hard reload and never landed.';

DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
CREATE TRIGGER on_auth_user_signed_in
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
EXECUTE FUNCTION public.sync_last_sign_in_at();

UPDATE public.users u SET last_sign_in_at = au.last_sign_in_at
FROM auth.users au WHERE au.id = u.id AND au.last_sign_in_at IS NOT NULL;

DROP FUNCTION public.touch_last_sign_in();
