SET lock_timeout = '3s';

-- Partnerships train PR 5 (PARTNERSHIPS_PLAN.md): the §3 profit split.
--
--   get_partner_job_split_preview(job) — six-bucket rollup for ONE job using
--     the SAME six verified cost streams as get_billed_aging_costs /
--     get_paid_job_email_payload (team labor × wages, sub labor books + drive,
--     mercury allocations, supply-house pct allocations, tally, other
--     charges), bucketed per the contract: labor = team + subs; materials =
--     mercury + supply + tally; direct = other charges (the §4h transfer rows
--     land there in PR 6); profit = revenue − labor − direct − materials.
--     Split math from the partnership row (company first cut, then the
--     remainder split) — never hard-coded.
--   post_partner_profit_share(job)    — writes the profit_share offset.
--     Idempotent via the PR 3 partial-unique index (one LIVE share per
--     job+person); repost returns the existing posting.
--   reverse_partner_profit_share(job) — explicit negating row (never edits).
--
-- Also CREATE OR REPLACEs generate_partner_statement: reversal rows (negative
-- profit_share) now attach as deductions of ABS(amount) instead of violating
-- pay_stub_additional_lines' rate >= 0 CHECK.

-- partnership_events grows the posting event types.
ALTER TABLE public.partnership_events DROP CONSTRAINT IF EXISTS partnership_events_event_type_check;
ALTER TABLE public.partnership_events ADD CONSTRAINT partnership_events_event_type_check
  CHECK (event_type IN ('created', 'config_changed', 'status_changed', 'statement_generated', 'profit_share_posted', 'profit_share_reversed'));

CREATE OR REPLACE FUNCTION public.partner_job_cost_buckets(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
WITH target AS (
  SELECT j.id, j.hcp_number FROM public.jobs_ledger j WHERE j.id = p_job_id
),
drive_settings AS (
  SELECT
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_mileage_cost'), 0.7) AS mileage_cost,
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_time_per_mile'), 0.02) AS time_per_mile
),
team_labor_days AS (
  SELECT cs.job_ledger_id AS job_id, u.id AS user_id, cs.work_date,
         SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours,
         COALESCE(MAX(ppc.hourly_wage), 0) AS wage
  FROM public.clock_sessions cs
  JOIN target t ON t.id = cs.job_ledger_id
  JOIN public.users u ON u.id = cs.user_id
  LEFT JOIN public.people per ON per.account_user_id = u.id AND per.archived_at IS NULL
  LEFT JOIN public.people_pay_config ppc
    ON (per.id IS NOT NULL AND ppc.person_id = per.id)
    OR (per.id IS NULL AND lower(trim(ppc.person_name)) = lower(trim(u.name)))
  WHERE cs.approved_at IS NOT NULL AND cs.revoked_at IS NULL AND cs.clocked_out_at IS NOT NULL
  GROUP BY cs.job_ledger_id, u.id, cs.work_date
),
team_labor AS (
  SELECT COALESCE(SUM(round((hours * COALESCE(wage, 0))::numeric, 2)), 0) AS cost FROM team_labor_days
),
sub_labor_books AS (
  SELECT plj.id, COALESCE(plj.labor_rate, 0) AS job_rate, COALESCE(plj.distance_miles, 0) AS miles
  FROM public.people_labor_jobs plj
  JOIN target t ON trim(COALESCE(t.hcp_number, '')) <> ''
    AND lower(trim(COALESCE(plj.job_number, ''))) = lower(trim(t.hcp_number))
),
sub_labor_lines AS (
  SELECT b.id AS book_id,
         COALESCE(SUM(COALESCE(i.direct_labor_amount,
           (CASE WHEN i.is_fixed THEN COALESCE(i.hrs_per_unit, 0)
                 ELSE COALESCE(i.count, 0) * COALESCE(i.hrs_per_unit, 0) END)
           * COALESCE(i.labor_rate, b.job_rate))), 0) AS line_total
  FROM sub_labor_books b
  LEFT JOIN public.people_labor_job_items i ON i.job_id = b.id
  GROUP BY b.id
),
sub_labor AS (
  SELECT COALESCE(SUM(l.line_total
           + CASE WHEN b.miles > 0 AND b.job_rate > 0
                    THEN b.miles * ds.mileage_cost + b.miles * ds.time_per_mile * b.job_rate
                  WHEN b.miles > 0 THEN b.miles * ds.mileage_cost
                  ELSE 0 END), 0) AS cost
  FROM sub_labor_books b
  JOIN sub_labor_lines l ON l.book_id = b.id
  CROSS JOIN drive_settings ds
),
parts AS (
  SELECT COALESCE(SUM(ABS(a.amount)), 0) AS cost
  FROM public.mercury_transaction_job_allocations a JOIN target t ON t.id = a.job_id
),
supply AS (
  SELECT COALESCE(SUM(COALESCE(shi.amount, 0) * COALESCE(al.pct, 0) / 100.0), 0) AS cost
  FROM public.supply_house_invoice_job_allocations al
  JOIN target t ON t.id = al.job_id
  JOIN public.supply_house_invoices shi ON shi.id = al.invoice_id
),
tally AS (
  SELECT COALESCE(SUM(CASE WHEN jtp.part_id IS NULL
                THEN COALESCE(jtp.fixture_cost, 0) * COALESCE(jtp.quantity, 0)
                ELSE COALESCE(poi.price_at_time, 0) * COALESCE(jtp.quantity, 0) END), 0) AS cost
  FROM public.jobs_tally_parts jtp
  JOIN target t ON t.id = jtp.job_id
  LEFT JOIN public.purchase_order_items poi
    ON poi.purchase_order_id = jtp.purchase_order_id AND poi.part_id = jtp.part_id
),
other AS (
  SELECT COALESCE(SUM(COALESCE(m.amount, 0)), 0) AS cost
  FROM public.jobs_ledger_materials m JOIN target t ON t.id = m.job_id
)
SELECT jsonb_build_object(
  'labor', round(((SELECT cost FROM team_labor) + (SELECT cost FROM sub_labor))::numeric, 2),
  'materials', round(((SELECT cost FROM parts) + (SELECT cost FROM supply) + (SELECT cost FROM tally))::numeric, 2),
  'direct', round((SELECT cost FROM other)::numeric, 2)
);
$$;
ALTER FUNCTION public.partner_job_cost_buckets(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_job_cost_buckets(uuid) IS
  'Internal: one job''s contract buckets from the six verified cost streams (labor = team+subs, materials = mercury+supply+tally, direct = other charges). Callers gate access.';
REVOKE EXECUTE ON FUNCTION public.partner_job_cost_buckets(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.partner_job_cost_buckets(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.partner_job_cost_buckets(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_partner_job_split_preview(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_j public.jobs_ledger%ROWTYPE;
  v_p public.partnerships%ROWTYPE;
  v_b jsonb;
  v_revenue numeric;
  v_labor numeric; v_materials numeric; v_direct numeric; v_profit numeric;
  v_first numeric; v_remainder numeric; v_partner numeric; v_company numeric;
  v_posted jsonb;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT * INTO v_j FROM public.jobs_ledger WHERE id = p_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'job not found'; END IF;
  IF v_j.partner_person_id IS NULL THEN
    RETURN jsonb_build_object('exists', false, 'reason', 'no partner majority flag on this job');
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE person_id = v_j.partner_person_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false, 'reason', 'flagged person has no partnership row');
  END IF;

  v_b := public.partner_job_cost_buckets(p_job_id);
  v_revenue := COALESCE(v_j.revenue, 0);
  v_labor := (v_b ->> 'labor')::numeric;
  v_materials := (v_b ->> 'materials')::numeric;
  v_direct := (v_b ->> 'direct')::numeric;
  v_profit := round(v_revenue - v_labor - v_materials - v_direct, 2);
  v_first := round(v_profit * v_p.company_first_pct / 100.0, 2);
  v_remainder := round(v_profit - v_first, 2);
  v_partner := round(v_remainder * v_p.partner_remainder_pct / 100.0, 2);
  v_company := round(v_remainder - v_partner, 2);

  SELECT jsonb_build_object('offset_id', o.id, 'amount', o.amount, 'posted_at', o.created_at,
                            'reversed', EXISTS (SELECT 1 FROM public.person_offsets r WHERE r.reversal_of_offset_id = o.id))
  INTO v_posted
  FROM public.person_offsets o
  WHERE o.job_id = p_job_id AND o.person_id = v_p.person_id
    AND o.type = 'profit_share' AND o.reversal_of_offset_id IS NULL
  LIMIT 1;

  RETURN jsonb_build_object(
    'exists', true,
    'partnership_id', v_p.id,
    'partner_person_id', v_p.person_id,
    'partner_name', v_p.display_name,
    'profit_shares_on', (v_p.modules ->> 'profit_shares') = 'true',
    'confirmed_at', v_j.partner_confirmed_at,
    'revenue', v_revenue,
    'labor', v_labor,
    'materials', v_materials,
    'direct', v_direct,
    'profit', v_profit,
    'company_first_pct', v_p.company_first_pct,
    'partner_remainder_pct', v_p.partner_remainder_pct,
    'company_first', v_first,
    'remainder', v_remainder,
    'partner_share', v_partner,
    'company_share', v_company,
    'posted', v_posted
  );
END;
$$;
ALTER FUNCTION public.get_partner_job_split_preview(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_partner_job_split_preview(uuid) IS
  'Dev-only §3 split preview for a partner-flagged job: contract buckets from the verified cost streams, split per the partnership config, plus any existing live posting.';
GRANT ALL ON FUNCTION public.get_partner_job_split_preview(uuid) TO anon;
GRANT ALL ON FUNCTION public.get_partner_job_split_preview(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_partner_job_split_preview(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.post_partner_profit_share(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev jsonb;
  v_person uuid;
  v_pid uuid;
  v_amount numeric;
  v_name text;
  v_label text;
  v_id uuid;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  v_prev := public.get_partner_job_split_preview(p_job_id);
  IF (v_prev ->> 'exists') <> 'true' THEN
    RAISE EXCEPTION 'no partner flag on this job';
  END IF;
  IF (v_prev ->> 'profit_shares_on') <> 'true' THEN
    RAISE EXCEPTION 'profit shares are off for this partnership';
  END IF;
  IF v_prev -> 'posted' IS NOT NULL AND (v_prev -> 'posted' ->> 'offset_id') IS NOT NULL THEN
    RETURN jsonb_build_object('offset_id', v_prev -> 'posted' ->> 'offset_id', 'already', true,
                              'amount', (v_prev -> 'posted' ->> 'amount')::numeric);
  END IF;
  v_amount := (v_prev ->> 'partner_share')::numeric;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'partner share is not positive (profit %). Nothing to post.', v_prev ->> 'profit';
  END IF;
  v_person := (v_prev ->> 'partner_person_id')::uuid;
  v_pid := (v_prev ->> 'partnership_id')::uuid;
  SELECT name INTO v_name FROM public.people WHERE id = v_person;
  SELECT COALESCE(NULLIF(btrim(COALESCE(hcp_number, '')), ''), NULLIF(btrim(COALESCE(click_number, '')), ''), NULLIF(btrim(COALESCE(job_name, '')), ''), id::text)
  INTO v_label FROM public.jobs_ledger WHERE id = p_job_id;

  BEGIN
    INSERT INTO public.person_offsets (person_name, person_id, type, amount, description, occurred_date, job_id)
    VALUES (v_name, v_person, 'profit_share', v_amount,
            'Profit share — Job ' || v_label || ' (§3: ' || (v_prev ->> 'company_first_pct') || '% first, ' || (v_prev ->> 'partner_remainder_pct') || '% of remainder)',
            (now() AT TIME ZONE 'America/Chicago')::date, p_job_id)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id, amount INTO v_id, v_amount FROM public.person_offsets
    WHERE job_id = p_job_id AND person_id = v_person AND type = 'profit_share' AND reversal_of_offset_id IS NULL;
    RETURN jsonb_build_object('offset_id', v_id, 'already', true, 'amount', v_amount);
  END;

  INSERT INTO public.partnership_events (partnership_id, event_type, patch, actor_user_id)
  VALUES (v_pid, 'profit_share_posted',
          jsonb_build_object('job_id', p_job_id, 'offset_id', v_id, 'amount', v_amount, 'profit', (v_prev ->> 'profit')::numeric),
          auth.uid());

  RETURN jsonb_build_object('offset_id', v_id, 'already', false, 'amount', v_amount);
END;
$$;
ALTER FUNCTION public.post_partner_profit_share(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.post_partner_profit_share(uuid) IS
  'Dev-only §3 posting: writes the partner''s profit-share offset for a flagged job at the partnership''s split. Idempotent (partial-unique index) — reposting returns the live posting. Reversals are reverse_partner_profit_share.';
GRANT ALL ON FUNCTION public.post_partner_profit_share(uuid) TO anon;
GRANT ALL ON FUNCTION public.post_partner_profit_share(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_partner_profit_share(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reverse_partner_profit_share(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig public.person_offsets%ROWTYPE;
  v_id uuid;
  v_pid uuid;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT o.* INTO v_orig FROM public.person_offsets o
  WHERE o.job_id = p_job_id AND o.type = 'profit_share' AND o.reversal_of_offset_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.person_offsets r WHERE r.reversal_of_offset_id = o.id)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no live profit-share posting on this job';
  END IF;

  INSERT INTO public.person_offsets (person_name, person_id, type, amount, description, occurred_date, job_id, reversal_of_offset_id)
  VALUES (v_orig.person_name, v_orig.person_id, 'profit_share', -v_orig.amount,
          'Reversal — ' || COALESCE(v_orig.description, 'profit share'),
          (now() AT TIME ZONE 'America/Chicago')::date, p_job_id, v_orig.id)
  RETURNING id INTO v_id;

  SELECT id INTO v_pid FROM public.partnerships WHERE person_id = v_orig.person_id;
  IF v_pid IS NOT NULL THEN
    INSERT INTO public.partnership_events (partnership_id, event_type, patch, actor_user_id)
    VALUES (v_pid, 'profit_share_reversed',
            jsonb_build_object('job_id', p_job_id, 'original_offset_id', v_orig.id, 'reversal_offset_id', v_id, 'amount', -v_orig.amount),
            auth.uid());
  END IF;

  RETURN jsonb_build_object('reversal_offset_id', v_id, 'amount', -v_orig.amount);
END;
$$;
ALTER FUNCTION public.reverse_partner_profit_share(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.reverse_partner_profit_share(uuid) IS
  'Dev-only: reverses the live profit-share posting on a job with an explicit negating row (never edits). The pair stays visible on the ledger forever.';
GRANT ALL ON FUNCTION public.reverse_partner_profit_share(uuid) TO anon;
GRANT ALL ON FUNCTION public.reverse_partner_profit_share(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reverse_partner_profit_share(uuid) TO service_role;

-- generate_partner_statement: reversal-aware offset attachment. Negative
-- amounts on positive types (reversals) attach as deductions of ABS(amount);
-- everything else unchanged from 20260820160000.
CREATE OR REPLACE FUNCTION public.generate_partner_statement(
  p_partnership_id uuid,
  p_week_start date,
  p_override boolean DEFAULT false
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
                             'unapproved_at_generate', v_unapproved, 'unreviewed_at_generate', v_unreviewed),
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
