SET lock_timeout = '3s';

-- v2.3628 Prospects access is a dev's call — an estimator can no longer grant it to themselves.
-- `users.estimator_prospects_access` was never in users_guard_privileged_columns(), and "Users can
-- update own profile" is row-scoped (auth.uid() = id), so an estimator could PATCH their own row
-- to true and user_has_prospects_staff_access() (20260906010000) then admitted them to the
-- Prospects tables. The flag's only editor is Active accounts → Edit, which is dev-only at all
-- three doors (Settings → People & accounts, People → Manage accounts, Person Desk → Manage
-- account…), so the rule is dev-only — the same rule as its sibling team_prospects_access.
--
-- REQUIRES 20260920033000_helper_trial.sql (users.trial_prospect_id): the function body below is
-- that migration's, verbatim, plus one check. A later rewrite copies from THIS file — the
-- 20260903191916 rewrite started from a stale body and silently dropped a guard.
-- Additive and idempotent; no table, column or policy change.

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
  -- The Hiring board is granted per person by a dev (restored v2.3627 — see the header).
  IF NEW.team_prospects_access IS DISTINCT FROM OLD.team_prospects_access AND v_role IS DISTINCT FROM 'dev' THEN
    RAISE EXCEPTION 'Only a dev can change Hiring board access' USING ERRCODE = 'P0001';
  END IF;
  -- v2.3627: the trial flag is the Hiring board's — never the helper's own.
  IF NEW.trial_prospect_id IS DISTINCT FROM OLD.trial_prospect_id THEN
    IF v_role IS DISTINCT FROM 'dev' AND NOT public.user_has_team_prospects_access() THEN
      RAISE EXCEPTION 'Only the Hiring board can change a try-out' USING ERRCODE = 'P0001';
    END IF;
    IF v_role IS DISTINCT FROM 'dev' AND NEW.id = v_uid THEN
      RAISE EXCEPTION 'You cannot change your own try-out' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- v2.3628: an estimator's Prospects grant is a dev's call — it feeds
  -- user_has_prospects_staff_access(), so a self-grant would open the Prospects tables.
  IF NEW.estimator_prospects_access IS DISTINCT FROM OLD.estimator_prospects_access AND v_role IS DISTINCT FROM 'dev' THEN
    RAISE EXCEPTION 'Only a dev can change an estimator''s Prospects access' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

ALTER FUNCTION public.users_guard_privileged_columns() OWNER TO postgres;
COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'BEFORE UPDATE guard on public.users: only a dev may change role, is_sample, team_prospects_access or estimator_prospects_access; a dev, controller, or pay-approved master may change read_only (never their own, except devs); a dev, master or assistant may change needs_supervision (never their own, except devs); a dev or a Hiring-board holder may change trial_prospect_id (never their own, except devs); archived_at is edge-flow (service-role) only. Service-role calls (auth.uid() IS NULL) pass through.';

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON public.users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision, team_prospects_access, trial_prospect_id, estimator_prospects_access ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();
