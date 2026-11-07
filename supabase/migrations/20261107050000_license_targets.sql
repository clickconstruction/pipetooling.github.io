SET lock_timeout = '3s';

-- v2.6626 · Punch list #255 · License targets: the class a teammate works toward, the board's own number, and the
-- hours before the clock started (the opening balance), set by the office on People → Licenses (PR 3 of the train).
--
--   * license_targets: one row a person and trade. target_class and target_amount override the ladder's seeded rule
--     (REQUIREMENTS in src/lib/logbook/logbook.ts) — the next license and the number the board asks for — and are set
--     or null together; a class at or below the license held is ignored by the kernel, never refused here, so a license
--     added later does not strand a row. opening_amount is the hours (plumbing, electrical) or months (HVAC) worked
--     before the clock started, with opening_source saying where they came from and where the signed form is.
--   * RLS: the row's own teammate or the Licenses audience (is_dev, is_assistant, is_pay_approved_master, the gate
--     list_user_license_hours_log keeps) reads; the audience alone writes. The four fences close it.
--   * week_card_data(user) and my_logbook() answer a 'targets' array, so Your week, the Monday email and the teammate's
--     own logbook read the same row the office set. my_week() is week_card_data(auth.uid()) and needs no change.

CREATE TABLE IF NOT EXISTS public.license_targets (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trade text NOT NULL CHECK (trade IN ('plumbing', 'electrical', 'hvac')),
  target_class text CHECK (target_class IS NULL OR target_class IN ('apprentice', 'tradesman', 'registered_tech', 'certified_tech', 'journeyman', 'master', 'contractor')),
  target_amount numeric CHECK (target_amount IS NULL OR target_amount > 0),
  opening_amount numeric NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  opening_source text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trade),
  CONSTRAINT license_targets_class_and_amount_together CHECK ((target_class IS NULL) = (target_amount IS NULL))
);

COMMENT ON TABLE public.license_targets IS
  'Punch list #255 (v2.6626): one row a person and trade, set by the office on People → Licenses. target_class and target_amount name the license worked toward and the number the board asks for, overriding the seeded ladder; opening_amount is the hours (or HVAC months) worked before the clock started, opening_source where they came from. Read by week_card_data(), my_logbook() and the logbook.';

ALTER TABLE public.license_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS license_targets_read ON public.license_targets;
CREATE POLICY license_targets_read ON public.license_targets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master());

DROP POLICY IF EXISTS license_targets_write ON public.license_targets;
CREATE POLICY license_targets_write ON public.license_targets FOR INSERT TO authenticated
  WITH CHECK (public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master());

DROP POLICY IF EXISTS license_targets_change ON public.license_targets;
CREATE POLICY license_targets_change ON public.license_targets FOR UPDATE TO authenticated
  USING (public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master())
  WITH CHECK (public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master());

DROP POLICY IF EXISTS license_targets_clear ON public.license_targets;
CREATE POLICY license_targets_clear ON public.license_targets FOR DELETE TO authenticated
  USING (public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master());

REVOKE ALL ON public.license_targets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_targets TO authenticated;

-- ---------- the readers: week_card_data() (my_week(), the Monday email) and my_logbook() gain 'targets' ----------

CREATE OR REPLACE FUNCTION public.week_card_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := p_user_id;
  v_name text;
  v_role text;
  v_signal text;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT u.name, u.role, u.week_signal, u.email INTO v_name, v_role, v_signal, v_email FROM public.users u WHERE u.id = v_uid;

  RETURN jsonb_build_object(
    'signal', v_signal,
    'name', coalesce(v_name, ''),
    'role', coalesce(v_role, ''),
    'email', coalesce(v_email, ''),
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
    'targets', coalesce((
      SELECT jsonb_agg(jsonb_build_object('trade', t.trade, 'target_class', t.target_class, 'target_amount', t.target_amount, 'opening_amount', t.opening_amount, 'opening_source', t.opening_source) ORDER BY t.trade)
      FROM public.license_targets t
      WHERE t.user_id = v_uid
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
    ), '[]'::jsonb),
    'words', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'customer_name', coalesce(r.customer_name, ''),
        'score', r.score,
        'words', coalesce(r.words, ''),
        'answered_at', r.answered_at,
        'google_pressed_at', r.google_pressed_at,
        'job_id', r.job_id,
        'job_number', COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
        'job_name', COALESCE(jl.job_name, ''),
        'job_address', COALESCE(jl.job_address, ''),
        'seen_at', s.seen_at
      ) ORDER BY r.answered_at DESC)
      FROM public.customer_ratings r
      JOIN public.jobs_ledger jl ON jl.id = r.job_id
      LEFT JOIN public.rating_credit_seen s ON s.rating_id = r.id AND s.user_id = v_uid
      WHERE r.answered_at IS NOT NULL
        AND r.score >= 4
        AND r.answered_at >= now() - interval '56 days'
        AND EXISTS (
          SELECT 1 FROM public.clock_sessions cs
          WHERE cs.job_ledger_id = r.job_id AND cs.user_id = v_uid AND cs.revoked_at IS NULL AND cs.rejected_at IS NULL
        )
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.my_logbook()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.logbook_shares WHERE user_id = v_uid) THEN
    RETURN NULL;
  END IF;
  SELECT u.name INTO v_name FROM public.users u WHERE u.id = v_uid;

  RETURN jsonb_build_object(
    'name', coalesce(v_name, ''),
    'hours', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'session_id', cs.id,
        'work_date', cs.work_date,
        'clocked_in_at', cs.clocked_in_at,
        'clocked_out_at', cs.clocked_out_at,
        'hours', (EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0)::numeric,
        'job_ledger_id', cs.job_ledger_id,
        'job_number', COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
        'job_name', COALESCE(jl.job_name, ''),
        'job_address', COALESCE(jl.job_address, ''),
        'service_type_name', COALESCE(st.name, ''),
        'bid_id', cs.bid_id,
        'notes', COALESCE(cs.notes, '')
      ) ORDER BY cs.work_date, cs.clocked_in_at)
      FROM public.clock_sessions cs
      LEFT JOIN public.jobs_ledger jl ON jl.id = cs.job_ledger_id
      LEFT JOIN public.service_types st ON st.id = jl.service_type_id
      WHERE cs.user_id = v_uid
        AND cs.approved_at IS NOT NULL
        AND cs.rejected_at IS NULL
        AND cs.revoked_at IS NULL
        AND cs.clocked_in_at IS NOT NULL
        AND cs.clocked_out_at IS NOT NULL
    ), '[]'::jsonb),
    'licenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', pl.id, 'license_type', pl.license_type, 'date_of_expiry', pl.date_of_expiry)
        ORDER BY pl.license_type)
      FROM public.person_licenses pl
      WHERE v_name IS NOT NULL AND pl.person_name = v_name
    ), '[]'::jsonb),
    'signers', coalesce((
      SELECT jsonb_agg(jsonb_build_object('person_name', pl.person_name, 'license_type', pl.license_type, 'date_of_expiry', pl.date_of_expiry)
        ORDER BY pl.person_name, pl.license_type)
      FROM public.person_licenses pl
      WHERE pl.person_name IS DISTINCT FROM v_name
        AND pl.license_type ~* '(master|contractor)'
        AND (pl.date_of_expiry IS NULL OR pl.date_of_expiry >= (now() AT TIME ZONE 'America/Chicago')::date)
        AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.name = pl.person_name AND u.archived_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.name = pl.person_name AND p.archived_at IS NOT NULL)
    ), '[]'::jsonb),
    'targets', coalesce((
      SELECT jsonb_agg(jsonb_build_object('trade', t.trade, 'target_class', t.target_class, 'target_amount', t.target_amount, 'opening_amount', t.opening_amount, 'opening_source', t.opening_source) ORDER BY t.trade)
      FROM public.license_targets t
      WHERE t.user_id = v_uid
    ), '[]'::jsonb),
    'office_job_id', (SELECT nullif(btrim(s.value_text), '') FROM public.app_settings s WHERE s.key = 'overhead_office_job_ledger_id_v1')
  );
END;
$$;

COMMENT ON FUNCTION public.week_card_data(uuid) IS
  'Punch list #255 (v2.6607; targets since v2.6626): one person''s Your week read, for the Monday email (your-week-email, as the service role) and my_week(). What my_week() answers, plus the person''s credited customer words of the last 56 days and their address, and their license_targets rows. The service role alone may call it.';
REVOKE ALL ON FUNCTION public.week_card_data(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.my_logbook() IS
  'Punch list #255 (v2.6483; targets since v2.6626): the signed-in teammate''s own logbook, once the office showed it (a logbook_shares row); NULL otherwise. Their approved closed clock hours with job metadata, the licenses under their name, current teammates'' supervising licenses for the signer line, their license_targets rows, and the office job id. Hours only, no wages.';
REVOKE ALL ON FUNCTION public.my_logbook() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_logbook() TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
