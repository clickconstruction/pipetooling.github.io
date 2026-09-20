SET lock_timeout = '3s';

-- v2.3627 Hiring: the helper try-out loop, PR 1 (to-dos/helper-tryout-loop) — Try-out is a stage.
-- A helper card's *Try out* makes the helper's login (create-user's trial branch, service role)
-- and links the card and the account both ways; the card's status becomes `trial`. Hire and Pass
-- end the trial through end_team_prospect_trial(). Additive and idempotent; no new table.
--
-- Also restores a guard this trigger lost: `team_prospects_access` was dev-only from
-- 20260717250000 until the 20260903191916 rewrite of users_guard_privileged_columns() dropped the
-- check (and 20260919044528 dropped the column from the trigger). "Users can update own profile"
-- is row-scoped, so without it any prospects-staff account can grant itself the Hiring board —
-- which, from this migration on, can make a login.

ALTER TABLE public.team_prospects
  ADD COLUMN IF NOT EXISTS trial_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.team_prospects
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS trial_prospect_id uuid REFERENCES public.team_prospects(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.team_prospects.trial_user_id IS
  'v2.3627 Try-out: the helper account Try out made for this card. Kept after Hire / Pass as the card''s link to the person; the trial itself is status = ''trial''.';
COMMENT ON COLUMN public.team_prospects.trial_started_at IS
  'v2.3627 Try-out: when Try out was pressed — the card''s "on trial since".';
COMMENT ON COLUMN public.users.trial_prospect_id IS
  'v2.3627 Try-out: non-null = a trial helper — on the roster and schedulable like any helper, still being tried out; points at the Hiring card. Set by create-user''s trial branch (service role), cleared by end_team_prospect_trial(). Guarded: a dev or a Hiring-board holder, never one''s own row (users_guard_privileged_columns).';

CREATE INDEX IF NOT EXISTS idx_users_trial_prospect_id ON public.users (trial_prospect_id) WHERE trial_prospect_id IS NOT NULL;

-- 'trial' joins the candidate lifecycle: active → calling → trial → hired / passed.
ALTER TABLE public.team_prospects DROP CONSTRAINT IF EXISTS team_prospects_status_check;
ALTER TABLE public.team_prospects ADD CONSTRAINT team_prospects_status_check
  CHECK (status IN ('active', 'calling', 'trial', 'hired', 'passed'));

-- The guard: same body as 20260919151642, plus team_prospects_access (restored, dev-only) and
-- trial_prospect_id (a dev or a Hiring-board holder; never one's own).
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
  RETURN NEW;
END $fn$;

ALTER FUNCTION public.users_guard_privileged_columns() OWNER TO postgres;
COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'BEFORE UPDATE guard on public.users: only a dev may change role, is_sample or team_prospects_access; a dev, controller, or pay-approved master may change read_only (never their own, except devs); a dev, master or assistant may change needs_supervision (never their own, except devs); a dev or a Hiring-board holder may change trial_prospect_id (never their own, except devs); archived_at is edge-flow (service-role) only. Service-role calls (auth.uid() IS NULL) pass through.';

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON public.users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision, team_prospects_access, trial_prospect_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();

-- Hire / Pass on a Try-out card: one call moves the card and clears the helper's trial flag, so
-- the two can never disagree. Hire leaves a regular helper; Pass leaves the login for the
-- archive-user flow (its own gate). Training-mode callers are stopped by the statement blocks on
-- both tables.
CREATE OR REPLACE FUNCTION public.end_team_prospect_trial(p_prospect_id uuid, p_outcome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_row public.team_prospects%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_team_prospects_access() THEN
    RAISE EXCEPTION 'Only the Hiring board can end a try-out' USING ERRCODE = '42501';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('hired', 'passed') THEN
    RAISE EXCEPTION 'p_outcome must be hired or passed' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_row FROM public.team_prospects WHERE id = p_prospect_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such candidate' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status IS DISTINCT FROM 'trial' THEN
    RAISE EXCEPTION 'This candidate is not on a try-out' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.team_prospects SET status = p_outcome WHERE id = p_prospect_id;
  UPDATE public.users SET trial_prospect_id = NULL WHERE trial_prospect_id = p_prospect_id;
  RETURN jsonb_build_object('prospect_id', p_prospect_id, 'status', p_outcome, 'trial_user_id', v_row.trial_user_id);
END $fn$;

ALTER FUNCTION public.end_team_prospect_trial(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.end_team_prospect_trial(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_team_prospect_trial(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.end_team_prospect_trial(uuid, text) IS
  'v2.3627 Try-out: Hire or Pass on a card whose status is trial — sets team_prospects.status and clears users.trial_prospect_id in one call. Hiring-board holders only (user_has_team_prospects_access). Keeps team_prospects.trial_user_id as the card''s link to the person.';
