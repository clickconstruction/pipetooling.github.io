SET lock_timeout = '3s';

-- v2.6589 · Punch list #255 · Your week: one progress signal a tech can watch move, every week.
--
-- 1. users.week_signal: the one signal the office picked for the person (license_hours, jobs_without_callback,
--    crew_vs_target), or NULL for no card. set_week_signal(user, signal) is the People desk's press, the office's.
-- 2. job_callbacks: the office's verdict on a Rework pair (Jobs → Job Summary → Rework): It was a callback, or Not a
--    callback. A pair counts against a tech only after the office presses; an inferred pair alone never reaches a card.
-- 3. my_week(): the tech's read, on auth.uid() alone. Their closed clock hours (approved and waiting) with job
--    metadata, the licenses under their name, the office job's id, the jobs they clocked onto in the last 120 days
--    with each job's open target, labor budget, every crew member's hours in aggregate and the day it finished, and
--    the confirmed callbacks among them. No wages, nobody else's hours by name.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS week_signal text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_week_signal_check') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_week_signal_check CHECK (week_signal IS NULL OR week_signal IN ('license_hours', 'jobs_without_callback', 'crew_vs_target'));
  END IF;
END $$;
COMMENT ON COLUMN public.users.week_signal IS
  'Punch list #255 (v2.6589): the one progress signal this person sees on Your week (license_hours, jobs_without_callback, crew_vs_target), picked by the office on the People desk through set_week_signal(). NULL: no card.';

CREATE OR REPLACE FUNCTION public.set_week_signal(p_user_id uuid, p_signal text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_master_or_dev() OR public.is_assistant()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the leader and the office pick a week signal.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.read_only OR u.is_digital_twin)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Training mode: you can look, but every change is blocked for your account.');
  END IF;
  IF p_signal IS NOT NULL AND p_signal NOT IN ('license_hours', 'jobs_without_callback', 'crew_vs_target') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That is not one of the three signals.');
  END IF;
  UPDATE public.users SET week_signal = p_signal WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No account by that id.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'signal', p_signal);
END;
$$;
COMMENT ON FUNCTION public.set_week_signal(uuid, text) IS
  'Punch list #255 (v2.6589): the People desk picks a person''s Your week signal, or clears it with NULL. The leader and the office; a training account or a twin is refused in words.';
REVOKE ALL ON FUNCTION public.set_week_signal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_week_signal(uuid, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.job_callbacks (
  first_job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  second_job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('callback', 'not_callback')),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  decided_by_name text NOT NULL DEFAULT '',
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (first_job_id, second_job_id)
);
COMMENT ON TABLE public.job_callbacks IS
  'Punch list #255 (v2.6589): the office''s verdict on a Rework pair (a return visit to the first job''s address): callback, or not_callback. Only a callback verdict counts against the techs clocked on the first job, on their Your week card. Pressed on Jobs → Job Summary → Rework; a second press replaces the verdict.';

ALTER TABLE public.job_callbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_callbacks_office_read ON public.job_callbacks;
CREATE POLICY job_callbacks_office_read ON public.job_callbacks FOR SELECT TO authenticated
  USING (public.is_master_or_dev() OR public.is_assistant() OR public.is_controller());
DROP POLICY IF EXISTS job_callbacks_office_write ON public.job_callbacks;
CREATE POLICY job_callbacks_office_write ON public.job_callbacks FOR INSERT TO authenticated
  WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS job_callbacks_office_change ON public.job_callbacks;
CREATE POLICY job_callbacks_office_change ON public.job_callbacks FOR UPDATE TO authenticated
  USING (public.is_master_or_dev() OR public.is_assistant())
  WITH CHECK (public.is_master_or_dev() OR public.is_assistant());
DROP POLICY IF EXISTS job_callbacks_office_delete ON public.job_callbacks;
CREATE POLICY job_callbacks_office_delete ON public.job_callbacks FOR DELETE TO authenticated
  USING (public.is_master_or_dev() OR public.is_assistant());

REVOKE ALL ON public.job_callbacks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_callbacks TO authenticated;

CREATE OR REPLACE FUNCTION public.my_week()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_role text;
  v_signal text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT u.name, u.role, u.week_signal INTO v_name, v_role, v_signal FROM public.users u WHERE u.id = v_uid;

  RETURN jsonb_build_object(
    'signal', v_signal,
    'name', coalesce(v_name, ''),
    'role', coalesce(v_role, ''),
    'hours', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'session_id', cs.id,
        'work_date', cs.work_date,
        'clocked_in_at', cs.clocked_in_at,
        'clocked_out_at', cs.clocked_out_at,
        'hours', (EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0)::numeric,
        'approved', cs.approved_at IS NOT NULL,
        'job_ledger_id', cs.job_ledger_id,
        'job_number', COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
        'job_name', COALESCE(jl.job_name, ''),
        'job_address', COALESCE(jl.job_address, ''),
        'service_type_name', COALESCE(st.name, ''),
        'bid_id', cs.bid_id
      ) ORDER BY cs.work_date, cs.clocked_in_at)
      FROM public.clock_sessions cs
      LEFT JOIN public.jobs_ledger jl ON jl.id = cs.job_ledger_id
      LEFT JOIN public.service_types st ON st.id = jl.service_type_id
      WHERE cs.user_id = v_uid
        AND cs.rejected_at IS NULL
        AND cs.revoked_at IS NULL
        AND cs.clocked_in_at IS NOT NULL
        AND cs.clocked_out_at IS NOT NULL
    ), '[]'::jsonb),
    'licenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('license_type', pl.license_type, 'date_of_expiry', pl.date_of_expiry) ORDER BY pl.license_type)
      FROM public.person_licenses pl
      WHERE v_name IS NOT NULL AND pl.person_name = v_name
    ), '[]'::jsonb),
    'office_job_id', (SELECT nullif(btrim(s.value_text), '') FROM public.app_settings s WHERE s.key = 'overhead_office_job_ledger_id_v1'),
    'jobs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'job_id', j.id,
        'job_number', COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), ''),
        'job_name', COALESCE(j.job_name, ''),
        'finished_ymd', CASE WHEN j.status IN ('billed', 'paid') THEN COALESCE(j.last_bill_date, j.last_work_date) END,
        'expected_hours', (SELECT e.hours FROM public.job_expected_hours e WHERE e.job_id = j.id AND e.cleared_at IS NULL ORDER BY e.set_at DESC LIMIT 1),
        'budget_hours', (SELECT b.labor_hours FROM public.job_budgets b WHERE b.job_id = j.id),
        'crew_hours', coalesce((
          SELECT sum(EXTRACT(EPOCH FROM (c2.clocked_out_at - c2.clocked_in_at)) / 3600.0)
          FROM public.clock_sessions c2
          WHERE c2.job_ledger_id = j.id AND c2.rejected_at IS NULL AND c2.revoked_at IS NULL AND c2.clocked_out_at IS NOT NULL
        ), 0)::numeric,
        'my_first_ymd', mine.first_ymd
      ) ORDER BY mine.first_ymd)
      FROM (
        SELECT cs.job_ledger_id AS job_id, min(cs.work_date) AS first_ymd
        FROM public.clock_sessions cs
        WHERE cs.user_id = v_uid AND cs.job_ledger_id IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
          AND cs.work_date >= (now() AT TIME ZONE 'America/Chicago')::date - 120
        GROUP BY cs.job_ledger_id
      ) mine
      JOIN public.jobs_ledger j ON j.id = mine.job_id
    ), '[]'::jsonb),
    'callbacks', coalesce((
      SELECT jsonb_agg(jsonb_build_object('first_job_id', k.first_job_id, 'second_job_id', k.second_job_id))
      FROM public.job_callbacks k
      WHERE k.verdict = 'callback'
        AND EXISTS (
          SELECT 1 FROM public.clock_sessions cs
          WHERE cs.user_id = v_uid AND cs.job_ledger_id = k.first_job_id AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
        )
    ), '[]'::jsonb)
  );
END;
$$;
COMMENT ON FUNCTION public.my_week() IS
  'Punch list #255 (v2.6589): the signed-in person''s Your week read. Their signal, their closed clock hours (approved and waiting) with job metadata, the licenses under their name, the office job id, the jobs they clocked onto in the last 120 days with the open target, the labor budget, the crew''s hours in aggregate and the finished day, and the confirmed callbacks among them. Hours only, no wages, nobody else''s hours by name. NULL with no caller.';
REVOKE ALL ON FUNCTION public.my_week() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_week() TO authenticated;

select public.apply_read_only_write_blocks();
select public.apply_read_only_stmt_blocks();
select public.apply_digital_twin_write_blocks();
select public.apply_archived_read_blocks();
