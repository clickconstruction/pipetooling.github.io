SET lock_timeout = '3s';

-- v2.5727 — The walk tester's flag (punch list #142, the walk kit, PR 2).
--
-- The walk kit (to-dos/walk-kit/README.md, decision 5) signs in as one hidden account to press the
-- three sends of the Messages loop at the kit's own address and number: walk-tester@walk.pipetooling.local,
-- role assistant, read_only (training mode, so every other write is blocked), is_sample false,
-- is_digital_twin false, and this flag. A second assistant sample would confuse the Sample accounts
-- card and View as, which read samples by role, so the tester gets a flag of its own.
--
-- Four things, each idempotent and additive:
--   1. users.is_walk_tester, boolean NOT NULL DEFAULT false (a constant default is a catalog change,
--      so the lock is brief).
--   2. users_guard_privileged_columns(): the live body (20260920050000, verbatim) plus one check: a
--      signed-in user never changes the flag; the service role (no JWT) passes by the early return, so
--      the kit's `walk` function sets it. The trigger is recreated with the column in its UPDATE OF list.
--      INSERT: "Owners can insert users" lets a dev insert, so a restrictive WITH CHECK keeps the flag
--      off any row a signed-in user inserts.
--   3. roster_people: both rollups leave a tester out, account_kind says 'tester', and is_walk_tester
--      is a new column, LAST (a replaced view may only add columns at the end).
--   4. A restrictive SELECT policy on users: a tester's row is read by itself and by devs alone, the
--      floor under every picker (PR 3 adds the client filters on top).
-- No CREATE TABLE, so the three apply_* fence calls are not needed.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_walk_tester boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_walk_tester IS
  'v2.5727 the walk kit (punch list #142): the one hidden tester account the kit signs in as to press the Messages loop''s sends at the kit''s own address and number. Training mode (read_only) as well, so it can write nothing else. Hidden from rosters, pickers and fan-outs like a sample; its row is read by itself and by devs only. Set by the kit''s walk function (service role) alone — users_guard_privileged_columns refuses every signed-in change.';

-- ---------------------------------------------------------------------------------------------
-- 2. The guard: the body of 20260920050000_guard_estimator_prospects_access.sql, plus one check.
--    A later rewrite copies from THIS file.
-- ---------------------------------------------------------------------------------------------

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
  -- v2.5727: the walk tester's flag is the walk kit's alone (service role, which returned above).
  -- Nobody signed in, a dev included, makes a tester or un-makes one from the client.
  IF NEW.is_walk_tester IS DISTINCT FROM OLD.is_walk_tester THEN
    RAISE EXCEPTION 'The walk kit sets this flag' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

ALTER FUNCTION public.users_guard_privileged_columns() OWNER TO postgres;
COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'BEFORE UPDATE guard on public.users: only a dev may change role, is_sample, team_prospects_access or estimator_prospects_access; a dev, controller, or pay-approved master may change read_only (never their own, except devs); a dev, master or assistant may change needs_supervision (never their own, except devs); a dev or a Hiring-board holder may change trial_prospect_id (never their own, except devs); archived_at is edge-flow (service-role) only; is_walk_tester is the walk kit''s (service-role) only. Service-role calls (auth.uid() IS NULL) pass through.';

DROP TRIGGER IF EXISTS users_guard_privileged_columns ON public.users;
CREATE TRIGGER users_guard_privileged_columns
  BEFORE UPDATE OF role, read_only, archived_at, is_sample, needs_supervision, team_prospects_access, trial_prospect_id, estimator_prospects_access, is_walk_tester ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged_columns();

-- "Owners can insert users" (baseline) lets a dev insert a users row from the client. The flag
-- stays off any row a signed-in user inserts; the kit inserts as the service role, which RLS
-- does not bind.
DROP POLICY IF EXISTS users_walk_tester_insert_kit_only ON public.users;
CREATE POLICY users_walk_tester_insert_kit_only ON public.users
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_walk_tester);

-- ---------------------------------------------------------------------------------------------
-- 3. The roster view: 20260922001000_roster_people_view.sql's definition, with the tester left
--    out of both rollups, named in account_kind, and carried as the last column.
-- ---------------------------------------------------------------------------------------------

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
    (u.id IS NOT NULL)                                                AS has_login,
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
  'People spine (v2.3698): one row per person — the users row, the people row, or the linked pair (people.account_user_id). Flags say what the row is (account_kind person | external | sample | twin | tester, is_archived, is_dev); is_pay_roster / is_active_roster are the rollups pay lists and crew pickers take as-is (a walk tester is in neither, v2.5727). Owner rights: every signed-in viewer sees the same roster. Names, roles, kinds and dates only. Ids CASE-wrapped (v2.2995) so PostgREST does not relate users / people FKs through it.';

REVOKE ALL ON public.roster_people FROM PUBLIC, anon;
GRANT SELECT ON public.roster_people TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. The floor: a tester's users row is read by itself and by devs alone.
-- ---------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS users_walk_tester_hidden ON public.users;
CREATE POLICY users_walk_tester_hidden ON public.users
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT is_walk_tester OR id = (SELECT auth.uid()) OR public.is_dev());
