SET lock_timeout = '3s';

-- View as, PR 1 (v2.3606): sample accounts. One real user per imitable role, flagged
-- users.is_sample, hidden from every roster and notification the way digital twins are, and
-- visible only under Settings → Active accounts → Sample accounts. A dev imitates one to see a
-- page as that role. Ordinary rows otherwise: no RLS change, writes stamped with their own name.
-- The flag is dev-set only, guarded like role / read_only / archived_at.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_sample IS
  'v2.3606 View as: a sample account — one per imitable role (sample-<role>@samples.pipetooling.local), hidden from rosters, pickers and notification fan-outs like a digital twin; a dev imitates it to see the app as that role. Dev-set only (users_guard_privileged_columns).';

CREATE OR REPLACE FUNCTION public.users_guard_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid;
  v_role text;
  v_can_train boolean;
BEGIN
  v_uid := auth.uid();
  -- No JWT (service-role / edge function / postgres): allow. Edge functions gate in code.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT role::text INTO v_role FROM public.users WHERE id = v_uid;
  IF NEW.role IS DISTINCT FROM OLD.role AND v_role IS DISTINCT FROM 'dev' THEN
    RAISE EXCEPTION 'Only a dev can change a user''s role' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.read_only IS DISTINCT FROM OLD.read_only THEN
    v_can_train :=
      v_role = 'dev'
      OR v_role = 'controller'
      OR (v_role = 'master_technician' AND EXISTS (SELECT 1 FROM public.pay_approved_masters pam WHERE pam.master_id = v_uid));
    IF NOT COALESCE(v_can_train, false) THEN
      RAISE EXCEPTION 'Only a dev, a controller, or a pay-approved master can change read-only (training) mode' USING ERRCODE = 'P0001';
    END IF;
    IF v_role IS DISTINCT FROM 'dev' AND NEW.id = v_uid THEN
      RAISE EXCEPTION 'You cannot change training mode on your own account' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- archived_at is never set from an authenticated client; archive/restore go through the
  -- service-role edge functions (which also ban/unban the auth user). Block all authenticated writes.
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'archived_at is managed by the archive/restore flow only' USING ERRCODE = 'P0001';
  END IF;
  -- v2.3606: the sample flag is a dev's call — a user must not be able to hide themselves
  -- from the roster, nor un-hide a sample.
  IF NEW.is_sample IS DISTINCT FROM OLD.is_sample AND v_role IS DISTINCT FROM 'dev' THEN
    RAISE EXCEPTION 'Only a dev can change whether an account is a sample' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

ALTER FUNCTION public.users_guard_privileged_columns() OWNER TO postgres;
COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'BEFORE UPDATE guard on public.users: only a dev may change role or is_sample; a dev, controller, or pay-approved master may change read_only (never their own, except devs); archived_at is edge-flow (service-role) only. Service-role calls (auth.uid() IS NULL) pass through.';

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON public.users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE UPDATE OF role, read_only, archived_at, is_sample ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();
