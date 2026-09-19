SET lock_timeout = '3s';

-- v2.3611 Supervision, PR 1 (to-dos/supervision): one switch instead of team leads.
-- `users.needs_supervision` — true for every helper and sub until the office decides they
-- can run a job; false (meaningless) for every other role, so the rule "a job-day is covered
-- when someone listed on it does not need supervision" is one line. Masters supervise by
-- definition and carry no switch. Additive and idempotent; no RLS change (the existing
-- "Masters assistants devs can update user notes" UPDATE policy admits the writers; the
-- guard trigger below says who may flip it).

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS needs_supervision boolean NOT NULL DEFAULT true;

-- Backfill: the switch only means something for helpers and subs. Everyone else is not field
-- labour (office roles, superintendents) or supervises by definition (masters).
UPDATE public.users
   SET needs_supervision = false
 WHERE needs_supervision = true
   AND role::text NOT IN ('helpers', 'subcontractor');

COMMENT ON COLUMN public.users.needs_supervision IS
  'v2.3611 Supervision: true = this helper or sub needs someone who can run the job on their block; false = they can run a job (count as coverage, carry the supervisor''s duties). Meaningful for helpers and subcontractors only; masters supervise by definition. Set by dev / master / assistant (users_guard_privileged_columns); new helper and sub accounts start true.';

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
  -- v2.3611: whether a helper or sub can run a job is the office's call — dev, master or
  -- assistant — and never the person's own.
  IF NEW.needs_supervision IS DISTINCT FROM OLD.needs_supervision THEN
    IF v_role IS DISTINCT FROM 'dev' AND v_role IS DISTINCT FROM 'master_technician' AND v_role IS DISTINCT FROM 'assistant' THEN
      RAISE EXCEPTION 'Only a dev, a master, or an assistant can change whether someone needs supervision' USING ERRCODE = 'P0001';
    END IF;
    IF v_role IS DISTINCT FROM 'dev' AND NEW.id = v_uid THEN
      RAISE EXCEPTION 'You cannot change supervision on your own account' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

ALTER FUNCTION public.users_guard_privileged_columns() OWNER TO postgres;
COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'BEFORE UPDATE guard on public.users: only a dev may change role or is_sample; a dev, controller, or pay-approved master may change read_only (never their own, except devs); a dev, master or assistant may change needs_supervision (never their own, except devs); archived_at is edge-flow (service-role) only. Service-role calls (auth.uid() IS NULL) pass through.';

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON public.users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();
