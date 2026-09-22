SET lock_timeout = '3s';

-- Hiring: the helper try-out loop, PR 3 (to-dos/helper-tryout-loop) — the tally on the card.
-- The office reads, per trial helper, the days they worked, who could have answered each day
-- (the Supervision rule, trial_helper_supervisors — service role only), and every leader's
-- verdict by name. A board holder cannot read clock_sessions and cannot call the rule, so the
-- read is one SECURITY DEFINER RPC gated on the board. *Keep trying* is two columns on the card:
-- the nudge stays quiet until a verdict newer than the deferral lands. Additive and idempotent;
-- no new table, so no read-only appliers.

ALTER TABLE public.team_prospects
  ADD COLUMN IF NOT EXISTS trial_deferred_at timestamptz;
ALTER TABLE public.team_prospects
  ADD COLUMN IF NOT EXISTS trial_deferred_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.team_prospects.trial_deferred_at IS
  'v2.3715 Try-out: when the office last pressed Keep trying on the card''s nudge. The nudge stays quiet until a verdict newer than this lands; Hire / Pass are unaffected.';
COMMENT ON COLUMN public.team_prospects.trial_deferred_by IS
  'v2.3715 Try-out: who pressed Keep trying (trial_deferred_at).';

-- The tally, one object per card on trial:
--   { prospect_id, helper_user_id, deferred_at, deferred_by, deferred_by_name,
--     days: [ { work_date, clocked, open, job_id, hcp_number, click_number, job_name, customer_name,
--               leaders: [ { user_id, name, role } ] } ],
--     verdicts: [ { leader_user_id, leader_name, leader_role, work_date, verdict, note, updated_at } ] }
-- A day is any date up to today the helper clocked, was listed on a block, or has a verdict for;
-- `clocked` says whether a clock session backs it, `open` whether one is still running. `leaders`
-- are the people the rule would have asked that day — so the card can say "nobody who could run
-- the job was on the block" and "waiting on Mike". Empty for anyone without the Hiring board.
CREATE OR REPLACE FUNCTION public.team_prospect_trial_tally()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cards AS (
    SELECT tp.id AS prospect_id, tp.trial_user_id AS helper_user_id,
           tp.trial_deferred_at, tp.trial_deferred_by
      FROM public.team_prospects tp
     WHERE tp.status = 'trial' AND tp.trial_user_id IS NOT NULL
       AND (public.is_dev() OR public.user_has_team_prospects_access())
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
  'v2.3715 Try-out: the tally behind every card on the Try-out stage — the helper''s days (clocked, listed, or with a verdict), who could have answered each day (trial_helper_supervisors), every leader''s verdict by name, and the Keep trying stamp. Hiring-board holders and devs only; empty for everyone else. SECURITY DEFINER because the board cannot read clock_sessions or call the rule itself. When the column share (PR 4) exists, its rule joins the gate here.';

REVOKE EXECUTE ON FUNCTION public.team_prospect_trial_tally() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_prospect_trial_tally() TO authenticated;
