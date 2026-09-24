SET lock_timeout = '3s';

-- v2.3798 Hiring → the helper try-out loop, PR 4 (to-dos/helper-tryout-loop): the column share.
--
-- A full Hiring-board holder (users.team_prospects_access) shares one role column with a person
-- who has prospects staff access but not the switch — the assistant who feeds helpers to the
-- masters. One row per column and person. The holder of a share sees that column's cards on
-- Screen, Interview and Try-out (status active / calling / trial), may add, edit, rank, Talked
-- today, Advance and Try out inside it, and nothing else: never Hire, Passed, Keep trying, a move
-- to another column, a delete, a rename, the Hire or Review stages, or another column's cards.
-- Enforced here, in RLS, not only hidden by the client (PR 6 draws the trimmed tab).
--
-- The share rule joins two of the three gates PR 3 named: create-user's Try out door (through
-- user_can_work_team_prospect) and team_prospect_trial_tally(). end_team_prospect_trial() keeps
-- its gate on purpose — Hire and Pass are the office's (the to-do's decision 5).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. The table
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_prospect_role_shares (
  role_id uuid NOT NULL REFERENCES public.team_prospect_roles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shared_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, user_id)
);

COMMENT ON TABLE public.team_prospect_role_shares IS
  'v2.3798 Hiring column share: one row per role column and person it is shared with. Written by a full Hiring-board holder (user_has_team_prospects_access); read through user_hiring_shared_role_ids(), which the hiring policies join. A share never turns users.team_prospects_access on, and is inert for anyone without prospects staff access.';
COMMENT ON COLUMN public.team_prospect_role_shares.shared_by IS 'Who shared the column (the Active accounts line reads it).';

CREATE INDEX IF NOT EXISTS idx_team_prospect_role_shares_user ON public.team_prospect_role_shares (user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. The share rule
-- ───────────────────────────────────────────────────────────────────────────

-- The columns shared with the caller. Empty without prospects staff access, so a share written
-- to a helper or a customer account grants nothing.
CREATE OR REPLACE FUNCTION public.user_hiring_shared_role_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.role_id
    FROM public.team_prospect_role_shares s
   WHERE s.user_id = (SELECT auth.uid())
     AND public.user_has_prospects_staff_access();
$$;

ALTER FUNCTION public.user_hiring_shared_role_ids() OWNER TO postgres;
COMMENT ON FUNCTION public.user_hiring_shared_role_ids() IS
  'v2.3798 Hiring column share: the role columns shared with the caller (team_prospect_role_shares), empty without prospects staff access. Joined by the team_prospects / team_prospect_roles policies and the tally RPC beside user_has_team_prospects_access().';
REVOKE EXECUTE ON FUNCTION public.user_hiring_shared_role_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_hiring_shared_role_ids() TO authenticated;

-- May the caller work this card? The board, a dev, or a share on the card's column. The gate
-- create-user's Try out door reads (the card itself is still read as the caller, under RLS).
CREATE OR REPLACE FUNCTION public.user_can_work_team_prospect(p_prospect_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_dev()
      OR public.user_has_team_prospects_access()
      OR EXISTS (
           SELECT 1 FROM public.team_prospects tp
            WHERE tp.id = p_prospect_id
              AND tp.role_id IN (SELECT public.user_hiring_shared_role_ids())
         );
$$;

ALTER FUNCTION public.user_can_work_team_prospect(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.user_can_work_team_prospect(uuid) IS
  'v2.3798 Hiring column share: true for a dev, a full Hiring-board holder, or someone the card''s column is shared with. create-user''s trial_prospect_id door calls it; the trial verdicts SELECT policy reads it.';
REVOKE EXECUTE ON FUNCTION public.user_can_work_team_prospect(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_work_team_prospect(uuid) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Policies on the shares table: the board reads and writes; a person reads their own
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.team_prospect_role_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hiring board and the holder read column shares" ON public.team_prospect_role_shares;
CREATE POLICY "Hiring board and the holder read column shares" ON public.team_prospect_role_shares
  FOR SELECT USING (
    public.user_has_team_prospects_access()
    OR public.is_dev()
    OR user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Hiring board shares a column" ON public.team_prospect_role_shares;
CREATE POLICY "Hiring board shares a column" ON public.team_prospect_role_shares
  FOR INSERT WITH CHECK (
    public.user_has_team_prospects_access()
    AND shared_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Hiring board unshares a column" ON public.team_prospect_role_shares;
CREATE POLICY "Hiring board unshares a column" ON public.team_prospect_role_shares
  FOR DELETE USING (public.user_has_team_prospects_access());

-- No UPDATE policy: a share is made or removed, never edited.

GRANT SELECT, INSERT, DELETE ON public.team_prospect_role_shares TO authenticated;
GRANT ALL ON public.team_prospect_role_shares TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. The columns: a shared column is readable; rename / delete / add stay the board's.
--    A dev reads the column names too (the Active accounts line says which columns an account
--    holds) — the cards stay behind the switch.
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Prospects staff can see all team prospect roles" ON public.team_prospect_roles;
CREATE POLICY "Prospects staff can see all team prospect roles" ON public.team_prospect_roles
  FOR SELECT USING (
    public.user_has_team_prospects_access()
    OR public.is_dev()
    OR id IN (SELECT public.user_hiring_shared_role_ids())
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 5. The cards: a shared column's Screen / Interview / Try-out cards
-- ───────────────────────────────────────────────────────────────────────────

-- Read: the board sees everything; a share sees the column's cards that are still in play —
-- never a hired or passed card (the Hire stage and the Passed list are the office's).
DROP POLICY IF EXISTS "Prospects staff can see all team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can see all team prospects" ON public.team_prospects
  FOR SELECT USING (
    public.user_has_team_prospects_access()
    OR (
      role_id IN (SELECT public.user_hiring_shared_role_ids())
      AND status IN ('active', 'calling', 'trial')
    )
  );

-- Update: a share edits, ranks, Talked-todays and Advances (active ↔ calling) a card in its
-- column, and the row must still be in that column and on Screen or Interview afterwards — so
-- Hire, Passed, a move to another column and Keep trying (a trial card) are refused here.
DROP POLICY IF EXISTS "Prospects staff can update all team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can update all team prospects" ON public.team_prospects
  FOR UPDATE USING (
    public.user_has_team_prospects_access()
    OR (
      role_id IN (SELECT public.user_hiring_shared_role_ids())
      AND status IN ('active', 'calling')
    )
  )
  WITH CHECK (
    public.user_has_team_prospects_access()
    OR (
      role_id IN (SELECT public.user_hiring_shared_role_ids())
      AND status IN ('active', 'calling')
    )
  );

-- Insert: the existing rule (office staff, or the board under the owner rules) plus a share —
-- a new card by the caller, on Screen, in a shared column, under the same owner rules.
DROP POLICY IF EXISTS "Prospects staff can insert team prospects" ON public.team_prospects;
CREATE POLICY "Prospects staff can insert team prospects" ON public.team_prospects
  FOR INSERT WITH CHECK (
    public.is_office_staff()
    OR (
      (
        public.user_has_team_prospects_access()
        OR (
          role_id IN (SELECT public.user_hiring_shared_role_ids())
          AND status = 'active'
        )
      )
      AND created_by = (SELECT auth.uid())
      AND (
        master_user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = (SELECT auth.uid())
            AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role])
        )
        OR EXISTS (
          SELECT 1 FROM public.master_assistants
          WHERE master_assistants.master_id = team_prospects.master_user_id
            AND master_assistants.assistant_id = (SELECT auth.uid())
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.users eu
            WHERE eu.id = (SELECT auth.uid())
              AND eu.role = 'estimator'::public.user_role
              AND COALESCE(eu.estimator_prospects_access, false)
          )
          AND EXISTS (
            SELECT 1 FROM public.users m
            WHERE m.id = team_prospects.master_user_id
              AND m.role = 'master_technician'::public.user_role
          )
        )
      )
    )
  );

-- Delete stays the board's ("Prospects staff can delete team prospects" is unchanged).

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Trial verdicts: readable on a shared column's Try-out card
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Hiring board and the leader read trial verdicts" ON public.team_prospect_trial_verdicts;
CREATE POLICY "Hiring board and the leader read trial verdicts" ON public.team_prospect_trial_verdicts
  FOR SELECT USING (
    public.user_can_work_team_prospect(prospect_id)
    OR leader_user_id = (SELECT auth.uid())
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 7. The tally: a share reads its column's Try-out cards
-- ───────────────────────────────────────────────────────────────────────────

-- Same body as 20260922120000_trial_tally.sql; only the cards gate changes.
CREATE OR REPLACE FUNCTION public.team_prospect_trial_tally()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cards AS (
    SELECT tp.id AS prospect_id, tp.trial_user_id AS helper_user_id,
           tp.trial_deferred_at, tp.trial_deferred_by
      FROM public.team_prospects tp
     WHERE tp.status = 'trial' AND tp.trial_user_id IS NOT NULL
       AND (
         public.is_dev()
         OR public.user_has_team_prospects_access()
         OR tp.role_id IN (SELECT public.user_hiring_shared_role_ids())
       )
  ),
  day_source AS (
    SELECT c.prospect_id, s.work_date, true AS clocked
      FROM cards c
      JOIN public.clock_sessions s ON s.user_id = c.helper_user_id
     WHERE s.rejected_at IS NULL AND s.revoked_at IS NULL AND s.work_date <= public.app_today()
    UNION ALL
    SELECT c.prospect_id, b.work_date, false
      FROM cards c
      JOIN public.job_schedule_blocks b ON b.assignee_user_id = c.helper_user_id
     WHERE b.work_date <= public.app_today()
    UNION ALL
    SELECT c.prospect_id, v.work_date, false
      FROM cards c
      JOIN public.team_prospect_trial_verdicts v ON v.prospect_id = c.prospect_id
  ),
  days AS (
    SELECT d.prospect_id, d.work_date, bool_or(d.clocked) AS clocked
      FROM day_source d
     GROUP BY d.prospect_id, d.work_date
  ),
  day_rows AS (
    SELECT d.prospect_id, d.work_date, d.clocked,
           EXISTS (SELECT 1 FROM public.clock_sessions o
                    WHERE o.user_id = c.helper_user_id AND o.work_date = d.work_date AND o.clocked_out_at IS NULL
                      AND o.rejected_at IS NULL AND o.revoked_at IS NULL) AS open,
           job.job_id,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', sup.leader_user_id, 'name', u.name, 'role', u.role::text) ORDER BY u.name), '[]'::jsonb)
              FROM (SELECT DISTINCT s.leader_user_id FROM public.trial_helper_supervisors(c.helper_user_id, d.work_date) s) sup
              JOIN public.users u ON u.id = sup.leader_user_id) AS leaders
      FROM days d
      JOIN cards c ON c.prospect_id = d.prospect_id
      LEFT JOIN LATERAL (
        SELECT s.job_ledger_id AS job_id FROM public.clock_sessions s
         WHERE s.user_id = c.helper_user_id AND s.work_date = d.work_date AND s.job_ledger_id IS NOT NULL
           AND s.rejected_at IS NULL AND s.revoked_at IS NULL
         ORDER BY s.clocked_in_at LIMIT 1
      ) job ON true
  ),
  day_json AS (
    SELECT r.prospect_id,
           jsonb_agg(jsonb_build_object(
             'work_date', r.work_date,
             'clocked', r.clocked,
             'open', r.open,
             'job_id', COALESCE(r.job_id, blk.job_id),
             'hcp_number', j.hcp_number,
             'click_number', j.click_number,
             'job_name', j.job_name,
             'customer_name', j.customer_name,
             'leaders', r.leaders
           ) ORDER BY r.work_date) AS days
      FROM day_rows r
      JOIN cards c ON c.prospect_id = r.prospect_id
      LEFT JOIN LATERAL (
        SELECT b.job_id FROM public.job_schedule_blocks b
         WHERE b.assignee_user_id = c.helper_user_id AND b.work_date = r.work_date AND b.job_id IS NOT NULL
         ORDER BY b.created_at LIMIT 1
      ) blk ON r.job_id IS NULL
      LEFT JOIN public.jobs_ledger j ON j.id = COALESCE(r.job_id, blk.job_id)
     GROUP BY r.prospect_id
  ),
  verdict_json AS (
    SELECT v.prospect_id,
           jsonb_agg(jsonb_build_object(
             'leader_user_id', v.leader_user_id,
             'leader_name', u.name,
             'leader_role', u.role::text,
             'work_date', v.work_date,
             'verdict', v.verdict,
             'note', v.note,
             'updated_at', v.updated_at
           ) ORDER BY v.work_date DESC, v.updated_at DESC) AS verdicts
      FROM public.team_prospect_trial_verdicts v
      JOIN cards c ON c.prospect_id = v.prospect_id
      JOIN public.users u ON u.id = v.leader_user_id
     GROUP BY v.prospect_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'prospect_id', c.prospect_id,
           'helper_user_id', c.helper_user_id,
           'deferred_at', c.trial_deferred_at,
           'deferred_by', c.trial_deferred_by,
           'deferred_by_name', du.name,
           'days', COALESCE(dj.days, '[]'::jsonb),
           'verdicts', COALESCE(vj.verdicts, '[]'::jsonb)
         )), '[]'::jsonb)
    FROM cards c
    LEFT JOIN day_json dj ON dj.prospect_id = c.prospect_id
    LEFT JOIN verdict_json vj ON vj.prospect_id = c.prospect_id
    LEFT JOIN public.users du ON du.id = c.trial_deferred_by;
$$;

ALTER FUNCTION public.team_prospect_trial_tally() OWNER TO postgres;
COMMENT ON FUNCTION public.team_prospect_trial_tally() IS
  'v2.3715 Try-out: the tally behind every card on the Try-out stage — the helper''s days (clocked, listed, or with a verdict), who could have answered each day (trial_helper_supervisors), every leader''s verdict by name, and the Keep trying stamp. Hiring-board holders, devs and (v2.3798) whoever the card''s column is shared with; empty for everyone else. SECURITY DEFINER because the board cannot read clock_sessions or call the rule itself.';
REVOKE EXECUTE ON FUNCTION public.team_prospect_trial_tally() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_prospect_trial_tally() TO authenticated;

-- Required after every CREATE TABLE: block writes from read-only (training mode) users and twins.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
