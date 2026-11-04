SET lock_timeout = '3s';

-- Every worker is a users row from day one; a login is attached later (punch list #260, v2.6511, PR 1 of 5).
--
-- Until now a row in public.users WAS a login: users_id_fkey (users.id → auth.users.id ON DELETE CASCADE, the
-- baseline's) refused a row with no auth account behind it, so a worker with no login was a People record with
-- account_user_id NULL — who could hold no clock session and no Charged as, so a job they worked priced short
-- by every day they were out (#254's first pricing, 2026-11-04). The owner, the same day: "What if we treated all
-- people as just users with no login? this would make turning a person into a user easier than it has been
-- previously". The spike (card #260) found the auth server takes a chosen id on create (GoTrue ≥ v2.155.0; prod
-- v2.197.0), so a login can be attached to an existing users.id later and nothing that points at the row moves.
--
--   1. users_id_fkey is dropped. users.login_attached_at says whether a login stands behind the row (backfilled
--      from auth.users.created_at: every row today has one). users.email may be NULL — a day laborer has no
--      address to sign in with — under the CHECK that a row with a login has one; users_email_key stays, and
--      two NULLs sit under it.
--   2. handle_new_user (on_auth_user_created) lands on the existing row when the auth user was created with its
--      id: ON CONFLICT (id) DO UPDATE sets login_attached_at and takes the login's address (the one a person
--      signs in with wins, as change-user-email keeps the two together). A fresh id still inserts as before.
--   3. on_auth_user_deleted (new): deleting the auth account detaches — login_attached_at NULL — where the
--      cascade used to delete the users row and, through clock_sessions_user_id_fkey, every day under it.
--   4. users_guard_privileged_columns refuses a client's write to login_attached_at: the two auth triggers and the
--      service role set it, nobody signed in.
--   5. roster_people.has_login reads login_attached_at IS NOT NULL. account_kind 'external' (a People record with
--      no users row) stays until PR 3 backfills those records and sets people.account_user_id NOT NULL.
--
-- Nothing user-visible changes with this file alone: no row has login_attached_at NULL until PR 2 makes one.
-- No table is created, so no fence calls. Idempotent.

-- 1. The key, the column, the address.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS login_attached_at timestamptz;
COMMENT ON COLUMN public.users.login_attached_at IS
  'When a sign-in (an auth.users row of the same id) was attached to this row; NULL = a worker with no login (punch list #260, v2.6511). Set by the auth triggers (handle_new_user, on_auth_user_deleted) and the service role only; users_guard_privileged_columns refuses a client write.';

UPDATE public.users u
   SET login_attached_at = COALESCE(a.created_at, now())
  FROM auth.users a
 WHERE a.id = u.id AND u.login_attached_at IS NULL;

ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_login_has_email;
ALTER TABLE public.users ADD CONSTRAINT users_login_has_email
  CHECK (login_attached_at IS NULL OR email IS NOT NULL) NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_login_has_email;
COMMENT ON COLUMN public.users.email IS
  'The address the person signs in with; NULL for a worker with no login (v2.6511). A row with login_attached_at set has one (users_login_has_email). Unique where present (users_email_key).';

-- 2. A chosen-id create lands on the existing row.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  invited text := NEW.raw_user_meta_data->>'invited_role';
  r public.user_role;
BEGIN
  IF invited IN ('dev','master_technician','assistant','subcontractor',
                 'helpers','estimator','primary','superintendent','controller') THEN
    r := invited::public.user_role;
  ELSE
    r := 'helpers'::public.user_role;
  END IF;
  INSERT INTO public.users (id, email, name, role, login_attached_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    r,
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET login_attached_at = now(),
        email = COALESCE(EXCLUDED.email, public.users.email);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates the public.users row for a new auth user, or — when the auth user was created with an existing row''s id (the attach step of punch list #260, v2.6511) — stamps that row''s login_attached_at and takes the login''s address, leaving its name, role and every other column as they were. Role comes from raw_user_meta_data.invited_role when it is one of the modern roles; otherwise helpers.';

-- 3. Deleting the login detaches it.
CREATE OR REPLACE FUNCTION public.detach_login_on_auth_user_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.users SET login_attached_at = NULL WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.detach_login_on_auth_user_delete() IS
  'Trigger on_auth_user_deleted (v2.6511): when an auth account is deleted, the users row of the same id stays as a worker with no login (login_attached_at NULL). Before this the cascade through users_id_fkey deleted the row and every clock session under it.';

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.detach_login_on_auth_user_delete();

-- 4. The guard: 20261022044606's body plus login_attached_at.
CREATE OR REPLACE FUNCTION public.users_guard_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid uuid;
  v_role text;
  v_can_train boolean;
BEGIN
  v_uid := auth.uid();
  -- No JWT (service-role / edge function / postgres / the auth triggers): allow. Edge functions gate in code.
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
  -- v2.5727: the walk tester's flag is the walk kit's alone (service role, which returned above).
  -- Nobody signed in, a dev included, makes a tester or un-makes one from the client.
  IF NEW.is_walk_tester IS DISTINCT FROM OLD.is_walk_tester THEN
    RAISE EXCEPTION 'The walk kit sets this flag' USING ERRCODE = 'P0001';
  END IF;
  -- v2.6511: whether a login stands behind the row is the auth flow's to say (the two triggers on auth.users
  -- and the service role, which returned above), never a client's.
  IF NEW.login_attached_at IS DISTINCT FROM OLD.login_attached_at THEN
    RAISE EXCEPTION 'A login is attached and detached through the sign-in flow, not here' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

ALTER FUNCTION public.users_guard_privileged_columns() OWNER TO postgres;
COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'BEFORE UPDATE guard on public.users: only a dev may change role, is_sample, team_prospects_access or estimator_prospects_access; a dev, controller, or pay-approved master may change read_only (never their own, except devs); a dev, master or assistant may change needs_supervision (never their own, except devs); a dev or a Hiring-board holder may change trial_prospect_id (never their own, except devs); archived_at is edge-flow (service-role) only; is_walk_tester is the walk kit''s (service-role) only; login_attached_at is the auth triggers'' and the service role''s (v2.6511). Service-role calls (auth.uid() IS NULL) pass through.';

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON public.users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision, team_prospects_access, trial_prospect_id, estimator_prospects_access, is_walk_tester, login_attached_at ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();

-- 5. The roster view: 20261022044606's definition with has_login reading the column.
CREATE OR REPLACE VIEW public.roster_people AS
  SELECT
    (CASE WHEN u.id IS NOT NULL THEN u.id END)                        AS user_id,
    (CASE WHEN p.id IS NOT NULL THEN p.id END)                        AS person_id,
    COALESCE('u:' || u.id::text, 'p:' || p.id::text)                  AS row_key,
    COALESCE(NULLIF(btrim(u.name), ''), btrim(p.name))                AS pay_name,
    NULLIF(btrim(u.name), '')                                         AS account_name,
    btrim(p.name)                                                     AS roster_name,
    u.role::text                                                      AS role,
    COALESCE(
      p.kind,
      CASE u.role::text
        WHEN 'helpers' THEN 'helper'
        WHEN 'subcontractor' THEN 'sub'
        ELSE u.role::text
      END
    )                                                                 AS kind,
    CASE
      WHEN u.is_digital_twin THEN 'twin'
      WHEN u.is_walk_tester THEN 'tester'
      WHEN u.is_sample THEN 'sample'
      WHEN u.id IS NULL THEN 'external'
      ELSE 'person'
    END                                                               AS account_kind,
    COALESCE(u.is_digital_twin, false)                                AS is_digital_twin,
    COALESCE(u.is_sample, false)                                      AS is_sample,
    (u.role::text = 'dev')                                            AS is_dev,
    COALESCE(u.read_only, false)                                      AS read_only,
    COALESCE(u.needs_supervision, false)                              AS needs_supervision,
    u.archived_at                                                     AS user_archived_at,
    p.archived_at                                                     AS person_archived_at,
    (u.archived_at IS NOT NULL OR p.archived_at IS NOT NULL)          AS is_archived,
    (
      NOT COALESCE(u.is_digital_twin, false)
      AND NOT COALESCE(u.is_sample, false)
      AND NOT COALESCE(u.is_walk_tester, false)
      AND u.archived_at IS NULL
      AND p.archived_at IS NULL
    )                                                                 AS is_pay_roster,
    (
      NOT COALESCE(u.is_digital_twin, false)
      AND NOT COALESCE(u.is_sample, false)
      AND NOT COALESCE(u.is_walk_tester, false)
      AND u.archived_at IS NULL
      AND p.archived_at IS NULL
      AND (u.role IS NULL OR u.role::text <> 'dev')
    )                                                                 AS is_active_roster,
    (u.login_attached_at IS NOT NULL)                                 AS has_login,
    (p.id IS NOT NULL)                                                AS has_roster_row,
    p.start_date                                                      AS start_date,
    p.end_date                                                        AS end_date,
    p.master_user_id                                                  AS master_user_id,
    COALESCE(u.is_walk_tester, false)                                 AS is_walk_tester
  FROM public.users u
  FULL OUTER JOIN public.people p ON p.account_user_id = u.id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND COALESCE(NULLIF(btrim(u.name), ''), NULLIF(btrim(p.name), '')) IS NOT NULL;

COMMENT ON VIEW public.roster_people IS
  'People spine (v2.3698): one row per person — the users row, the people row, or the linked pair (people.account_user_id). Flags say what the row is (account_kind person | external | sample | twin | tester, is_archived, is_dev); is_pay_roster / is_active_roster are the rollups pay lists and crew pickers take as-is (a walk tester is in neither, v2.5727). has_login reads users.login_attached_at (v2.6511): a users row with no sign-in behind it is a person, not a login. Owner rights: every signed-in viewer sees the same roster. Names, roles, kinds and dates only. Ids CASE-wrapped (v2.2995) so PostgREST does not relate users / people FKs through it.';

REVOKE ALL ON public.roster_people FROM PUBLIC, anon;
GRANT SELECT ON public.roster_people TO authenticated, service_role;
