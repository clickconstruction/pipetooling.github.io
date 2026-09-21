SET lock_timeout = '3s';

-- Hiring: the helper try-out loop, PR 2 (to-dos/helper-tryout-loop) — the leader's verdict.
-- When a trial helper's day on a job ends, everyone who could run that job that day is asked one
-- thing, by name: take them again? yes / no / not sure, and an optional word for the office.
--
-- WHO IS ASKED is the Supervision rule (v2.3611, src/lib/people/supervision.ts), read off the
-- schedule and the clock, nothing assigned: a master, or a helper / sub the office switched
-- "needs supervision" off for, who was listed (job_schedule_blocks) or clocked (clock_sessions)
-- on the same job the same day as the helper. The same shape as supervised_days_with() (v2.3614).
-- One row per card, leader and day. Additive and idempotent.

-- 1. The rule, in SQL: who could run the jobs a helper worked on a day ------------------------
CREATE OR REPLACE FUNCTION public.trial_helper_supervisors(p_helper_user_id uuid, p_work_date date)
RETURNS TABLE (leader_user_id uuid, job_ledger_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH theirs AS (
    SELECT b.job_id AS job_id FROM public.job_schedule_blocks b
     WHERE b.assignee_user_id = p_helper_user_id AND b.work_date = p_work_date AND b.job_id IS NOT NULL
    UNION
    SELECT s.job_ledger_id FROM public.clock_sessions s
     WHERE s.user_id = p_helper_user_id AND s.work_date = p_work_date
       AND s.job_ledger_id IS NOT NULL AND s.rejected_at IS NULL AND s.revoked_at IS NULL
  ),
  present AS (
    SELECT b.assignee_user_id AS user_id, b.job_id AS job_id FROM public.job_schedule_blocks b
      JOIN theirs t ON t.job_id = b.job_id
     WHERE b.work_date = p_work_date AND b.assignee_user_id IS NOT NULL
    UNION
    SELECT s.user_id, s.job_ledger_id FROM public.clock_sessions s
      JOIN theirs t ON t.job_id = s.job_ledger_id
     WHERE s.work_date = p_work_date AND s.rejected_at IS NULL AND s.revoked_at IS NULL
  )
  SELECT DISTINCT p.user_id, p.job_id
    FROM present p
    JOIN public.users u ON u.id = p.user_id
   WHERE p.user_id <> p_helper_user_id
     AND u.archived_at IS NULL
     AND (u.role::text = 'master_technician'
          OR (u.role::text IN ('helpers', 'subcontractor') AND NOT u.needs_supervision));
$$;

COMMENT ON FUNCTION public.trial_helper_supervisors(uuid, date) IS
  'Try-out loop: everyone who could run a job the helper worked that day (a master, or a helper / sub with needs_supervision off), from schedule blocks and clock sessions — the SQL twin of crewSupervisors(). Internal: gates trial verdict writes and feeds the clock-out push. Not granted to clients.';

REVOKE EXECUTE ON FUNCTION public.trial_helper_supervisors(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_helper_supervisors(uuid, date) TO service_role;

-- 2. The verdicts ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_prospect_trial_verdicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.team_prospects(id) ON DELETE CASCADE,
  leader_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('yes', 'no', 'unsure', 'skipped')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_prospect_trial_verdicts_one_per_day UNIQUE (prospect_id, leader_user_id, work_date)
);

COMMENT ON TABLE public.team_prospect_trial_verdicts IS
  'Try-out loop: a leader''s "take them again?" on a trial helper for one day — by name, never anonymous. One row per card, leader and day; ''skipped'' records that the card was dismissed so it is not dealt again.';

CREATE INDEX IF NOT EXISTS idx_trial_verdicts_prospect ON public.team_prospect_trial_verdicts (prospect_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_trial_verdicts_leader_day ON public.team_prospect_trial_verdicts (leader_user_id, work_date);

CREATE OR REPLACE FUNCTION public.team_prospect_trial_verdicts_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS team_prospect_trial_verdicts_touch ON public.team_prospect_trial_verdicts;
CREATE TRIGGER team_prospect_trial_verdicts_touch BEFORE UPDATE ON public.team_prospect_trial_verdicts
  FOR EACH ROW EXECUTE FUNCTION public.team_prospect_trial_verdicts_touch();

-- 3. May the caller give a verdict on this card for this day? --------------------------------
-- The card is on trial, the day is today or yesterday (the card stays up through the next
-- morning; an answer can be changed until then), and the caller could run a job the helper
-- worked that day.
CREATE OR REPLACE FUNCTION public.can_give_trial_verdict(p_prospect_id uuid, p_work_date date)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_work_date BETWEEN public.app_today() - 1 AND public.app_today()
     AND EXISTS (
       SELECT 1
         FROM public.team_prospects tp
         JOIN LATERAL public.trial_helper_supervisors(tp.trial_user_id, p_work_date) sup ON true
        WHERE tp.id = p_prospect_id AND tp.status = 'trial' AND tp.trial_user_id IS NOT NULL
          AND sup.leader_user_id = (SELECT auth.uid())
     );
$$;

REVOKE EXECUTE ON FUNCTION public.can_give_trial_verdict(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_give_trial_verdict(uuid, date) TO authenticated;

-- 4. Row security ---------------------------------------------------------------------------
ALTER TABLE public.team_prospect_trial_verdicts ENABLE ROW LEVEL SECURITY;

-- Read: the Hiring board (every leader's verdict, by name), a dev, and the leader their own.
DROP POLICY IF EXISTS "Hiring board and the leader read trial verdicts" ON public.team_prospect_trial_verdicts;
CREATE POLICY "Hiring board and the leader read trial verdicts" ON public.team_prospect_trial_verdicts
  FOR SELECT USING (
    public.user_has_team_prospects_access()
    OR public.is_dev()
    OR leader_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Leaders give their own trial verdicts" ON public.team_prospect_trial_verdicts;
CREATE POLICY "Leaders give their own trial verdicts" ON public.team_prospect_trial_verdicts
  FOR INSERT WITH CHECK (
    leader_user_id = (SELECT auth.uid())
    AND public.can_give_trial_verdict(prospect_id, work_date)
  );

DROP POLICY IF EXISTS "Leaders change their own trial verdicts" ON public.team_prospect_trial_verdicts;
CREATE POLICY "Leaders change their own trial verdicts" ON public.team_prospect_trial_verdicts
  FOR UPDATE USING (leader_user_id = (SELECT auth.uid()))
  WITH CHECK (
    leader_user_id = (SELECT auth.uid())
    AND public.can_give_trial_verdict(prospect_id, work_date)
  );

-- No DELETE policy: a verdict is changed, never removed; rows go with the card (ON DELETE CASCADE).

GRANT SELECT, INSERT, UPDATE ON public.team_prospect_trial_verdicts TO authenticated;
GRANT ALL ON public.team_prospect_trial_verdicts TO service_role;

-- 5. The card's feed: trial helpers I led today (and yesterday, until answered) --------------
-- p_include_open = false (the Dashboard): only helpers whose day is over — no open session.
-- p_include_open = true (the leader's own clock-out): the leader's day with them is over even
-- if the helper is still clocked in.
CREATE OR REPLACE FUNCTION public.trial_helpers_i_led_today(p_include_open boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH days AS (
    SELECT d::date AS work_date FROM generate_series(public.app_today() - 1, public.app_today(), interval '1 day') d
  ),
  led AS (
    SELECT tp.id AS prospect_id, tp.trial_user_id AS helper_user_id, tp.name AS card_name,
           d.work_date, (array_agg(sup.job_ledger_id ORDER BY sup.job_ledger_id))[1] AS job_ledger_id
      FROM public.team_prospects tp
      CROSS JOIN days d
      JOIN LATERAL public.trial_helper_supervisors(tp.trial_user_id, d.work_date) sup ON sup.leader_user_id = (SELECT auth.uid())
     WHERE tp.status = 'trial' AND tp.trial_user_id IS NOT NULL
     GROUP BY tp.id, tp.trial_user_id, tp.name, d.work_date
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'prospect_id', l.prospect_id,
           'helper_user_id', l.helper_user_id,
           'helper_name', COALESCE(NULLIF(trim(u.name), ''), l.card_name),
           'work_date', l.work_date,
           'job_id', l.job_ledger_id,
           'hcp_number', j.hcp_number,
           'click_number', j.click_number,
           'job_name', j.job_name,
           'customer_name', j.customer_name,
           'trial_day', (SELECT count(DISTINCT s.work_date) FROM public.clock_sessions s
                          WHERE s.user_id = l.helper_user_id AND s.work_date <= l.work_date
                            AND s.rejected_at IS NULL AND s.revoked_at IS NULL),
           'verdict', v.verdict,
           'note', v.note
         ) ORDER BY l.work_date DESC, l.card_name), '[]'::jsonb)
    FROM led l
    JOIN public.users u ON u.id = l.helper_user_id
    LEFT JOIN public.jobs_ledger j ON j.id = l.job_ledger_id
    LEFT JOIN public.team_prospect_trial_verdicts v
           ON v.prospect_id = l.prospect_id AND v.leader_user_id = (SELECT auth.uid()) AND v.work_date = l.work_date
   WHERE (p_include_open OR NOT EXISTS (
            SELECT 1 FROM public.clock_sessions o
             WHERE o.user_id = l.helper_user_id AND o.work_date = l.work_date AND o.clocked_out_at IS NULL
               AND o.rejected_at IS NULL AND o.revoked_at IS NULL))
     -- yesterday's card leaves once it is answered; today's stays so the answer can be changed
     AND (l.work_date = public.app_today() OR v.id IS NULL);
$$;

COMMENT ON FUNCTION public.trial_helpers_i_led_today(boolean) IS
  'Try-out loop: the trial helpers the caller could run a job with today (and yesterday, while unanswered), with the job and the caller''s own verdict if given. Empty for anyone who cannot run a job. SECURITY DEFINER: the one narrow window onto a trial helper''s card for a leader with no Hiring board access.';

REVOKE EXECUTE ON FUNCTION public.trial_helpers_i_led_today(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trial_helpers_i_led_today(boolean) TO authenticated;

-- House rules for CREATE TABLE: training-mode blocks + statement trigger, and the twin write-fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
