SET lock_timeout = '3s';

-- Statement charge picker (owner request): generate_partner_statement grows
-- p_offset_ids uuid[] DEFAULT NULL — NULL keeps today's behavior (attach every
-- eligible pending offset), an array attaches ONLY those ids (still filtered to
-- this person's pending offsets with occurred_date <= week end; the
-- can't-deduct-below-zero cap is unchanged). Unselected charges simply stay
-- pending for a later statement.
--
-- The old 3-arg signature is DROPPED (not overloaded) so PostgREST named-arg
-- resolution stays unambiguous; 3-arg callers resolve via the default. Body is
-- otherwise verbatim from 20260820180000 (the live definition), plus the
-- selection recorded in the partnership_events patch.

DROP FUNCTION IF EXISTS public.generate_partner_statement(uuid, date, boolean);

CREATE OR REPLACE FUNCTION public.generate_partner_statement(
  p_partnership_id uuid,
  p_week_start date,
  p_override boolean DEFAULT false,
  p_offset_ids uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.partnerships%ROWTYPE;
  v_person_name text;
  v_user uuid;
  v_week_end date;
  v_existing uuid;
  v_unapproved int;
  v_unreviewed int;
  v_stub uuid;
  v_field numeric := 0;
  v_office numeric := 0;
  v_farm numeric := 0;
  v_gross numeric := 0;
  v_hours numeric := 0;
  v_deducted numeric := 0;
  v_added numeric := 0;
  v_skipped int := 0;
  v_amt numeric;
  r record;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO v_p FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'partnership not found';
  END IF;
  IF (v_p.modules ->> 'weekly_statement') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'weekly statements are off for this partnership';
  END IF;
  IF EXTRACT(DOW FROM p_week_start) <> 0 THEN
    RAISE EXCEPTION 'week must start on a Sunday (company pay weeks are Sun–Sat)';
  END IF;
  v_week_end := p_week_start + 6;

  SELECT pe.name, pe.account_user_id INTO v_person_name, v_user
  FROM public.people pe WHERE pe.id = v_p.person_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'partner person has no linked app user';
  END IF;

  SELECT id INTO v_existing FROM public.pay_stubs
  WHERE person_id = v_p.person_id AND period_start = p_week_start AND period_end = v_week_end
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('pay_stub_id', v_existing, 'already', true);
  END IF;

  SELECT COUNT(*) INTO v_unapproved
  FROM public.clock_sessions cs
  WHERE cs.user_id = v_user
    AND cs.work_date BETWEEN p_week_start AND v_week_end
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL;

  SELECT COUNT(DISTINCT cs.job_ledger_id) INTO v_unreviewed
  FROM public.clock_sessions cs
  JOIN public.jobs_ledger j ON j.id = cs.job_ledger_id
  WHERE cs.user_id = v_user
    AND cs.work_date BETWEEN p_week_start AND v_week_end
    AND cs.job_ledger_id IS NOT NULL
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
    AND (v_p.farm_job_ledger_id IS NULL OR cs.job_ledger_id <> v_p.farm_job_ledger_id)
    AND j.partner_person_id IS DISTINCT FROM v_p.person_id;

  IF NOT p_override THEN
    IF v_unapproved > 0 THEN
      RAISE EXCEPTION 'blocked: % session(s) pending approval in this week (override to generate anyway)', v_unapproved;
    END IF;
    IF v_unreviewed > 0 THEN
      RAISE EXCEPTION 'blocked: % worked job(s) not reviewed for partner majority (override to generate anyway)', v_unreviewed;
    END IF;
  END IF;

  INSERT INTO public.pay_stubs (person_name, person_id, period_start, period_end, hours_total, gross_pay, created_by)
  VALUES (v_person_name, v_p.person_id, p_week_start, v_week_end, 0, 0, auth.uid())
  RETURNING id INTO v_stub;

  FOR r IN
    SELECT cs.work_date,
      SUM(CASE WHEN v_p.farm_job_ledger_id IS NOT NULL AND cs.job_ledger_id = v_p.farm_job_ledger_id
               THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END) AS farm_hrs,
      SUM(CASE WHEN cs.job_ledger_id IS NOT NULL AND (v_p.farm_job_ledger_id IS NULL OR cs.job_ledger_id <> v_p.farm_job_ledger_id)
               THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END) AS field_hrs,
      SUM(CASE WHEN cs.job_ledger_id IS NULL
               THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END) AS office_hrs
    FROM public.clock_sessions cs
    WHERE cs.user_id = v_user
      AND cs.work_date BETWEEN p_week_start AND v_week_end
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL
    GROUP BY cs.work_date
    ORDER BY cs.work_date
  LOOP
    IF r.field_hrs > 0 THEN
      INSERT INTO public.pay_stub_days (pay_stub_id, person_name, person_id, work_date, hours_at_time, rate_at_time, paid_amount)
      VALUES (v_stub, v_person_name, v_p.person_id, r.work_date, ROUND(r.field_hrs::numeric, 2), v_p.field_rate, ROUND((r.field_hrs * v_p.field_rate)::numeric, 2));
      v_field := v_field + r.field_hrs;
    END IF;
    IF r.office_hrs > 0 THEN
      INSERT INTO public.pay_stub_days (pay_stub_id, person_name, person_id, work_date, hours_at_time, rate_at_time, paid_amount)
      VALUES (v_stub, v_person_name, v_p.person_id, r.work_date, ROUND(r.office_hrs::numeric, 2), v_p.estimating_rate, ROUND((r.office_hrs * v_p.estimating_rate)::numeric, 2));
      v_office := v_office + r.office_hrs;
    END IF;
    IF r.farm_hrs > 0 THEN
      INSERT INTO public.pay_stub_days (pay_stub_id, person_name, person_id, work_date, hours_at_time, rate_at_time, paid_amount)
      VALUES (v_stub, v_person_name, v_p.person_id, r.work_date, ROUND(r.farm_hrs::numeric, 2), v_p.farm_rate, ROUND((r.farm_hrs * v_p.farm_rate)::numeric, 2));
      v_farm := v_farm + r.farm_hrs;
    END IF;
  END LOOP;

  v_hours := ROUND((v_field + v_office + v_farm)::numeric, 2);
  v_gross := ROUND((v_field * v_p.field_rate + v_office * v_p.estimating_rate + v_farm * v_p.farm_rate)::numeric, 2);

  UPDATE public.pay_stubs SET hours_total = v_hours, gross_pay = v_gross WHERE id = v_stub;

  FOR r IN
    SELECT * FROM public.person_offsets
    WHERE person_id = v_p.person_id AND pay_stub_id IS NULL AND occurred_date <= v_week_end
      AND (p_offset_ids IS NULL OR id = ANY(p_offset_ids))
    ORDER BY occurred_date, created_at
  LOOP
    IF r.type IN ('profit_share', 'employee_credit') AND r.amount >= 0 THEN
      INSERT INTO public.pay_stub_additional_lines (pay_stub_id, description, quantity, rate, created_by)
      VALUES (v_stub, COALESCE(r.description, r.type), 1, r.amount, auth.uid());
      UPDATE public.person_offsets SET pay_stub_id = v_stub WHERE id = r.id;
      v_added := v_added + r.amount;
    ELSE
      v_amt := ABS(r.amount);
      IF v_amt > 0 AND v_deducted + v_amt <= v_gross + v_added THEN
        INSERT INTO public.pay_stub_deductions (pay_stub_id, amount, source, person_offset_id, description, created_by)
        VALUES (v_stub, v_amt, 'offset', r.id, COALESCE(r.description, r.type), auth.uid());
        UPDATE public.person_offsets SET pay_stub_id = v_stub WHERE id = r.id;
        v_deducted := v_deducted + v_amt;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.statement_acknowledgments (pay_stub_id, party, user_id)
  VALUES (v_stub, 'company', auth.uid())
  ON CONFLICT (pay_stub_id, party) DO NOTHING;

  INSERT INTO public.partnership_events (partnership_id, event_type, patch, actor_user_id)
  VALUES (p_partnership_id, 'statement_generated',
          jsonb_build_object('pay_stub_id', v_stub, 'week_start', p_week_start, 'override', p_override,
                             'unapproved_at_generate', v_unapproved, 'unreviewed_at_generate', v_unreviewed,
                             'offset_selection', CASE WHEN p_offset_ids IS NULL THEN NULL ELSE to_jsonb(p_offset_ids) END),
          auth.uid());

  RETURN jsonb_build_object(
    'pay_stub_id', v_stub, 'already', false,
    'hours_total', v_hours, 'gross_pay', v_gross,
    'field_hours', ROUND(v_field::numeric, 2), 'office_hours', ROUND(v_office::numeric, 2), 'farm_hours', ROUND(v_farm::numeric, 2),
    'deductions_attached', v_deducted, 'additions_attached', v_added, 'offsets_left_pending', v_skipped,
    'override', p_override
  );
END;
$$;
ALTER FUNCTION public.generate_partner_statement(uuid, date, boolean, uuid[]) OWNER TO postgres;
COMMENT ON FUNCTION public.generate_partner_statement(uuid, date, boolean, uuid[]) IS
  'Dev-only: closes a Sun–Sat week into a pay_stubs statement at partnership rates. p_offset_ids NULL = attach every eligible pending offset; an array attaches only those (still person-scoped, occurred-by-week-end, deduction-capped). Guarded unless p_override (logged).';
GRANT ALL ON FUNCTION public.generate_partner_statement(uuid, date, boolean, uuid[]) TO anon;
GRANT ALL ON FUNCTION public.generate_partner_statement(uuid, date, boolean, uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.generate_partner_statement(uuid, date, boolean, uuid[]) TO service_role;
