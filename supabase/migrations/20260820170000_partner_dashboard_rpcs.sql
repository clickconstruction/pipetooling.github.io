SET lock_timeout = '3s';

-- Partnerships train PR 4 (PARTNERSHIPS_PLAN.md): the partner's own windows.
-- Three SECURITY DEFINER RPCs resolve the CALLER to their partnership via
-- people.account_user_id (the person-id-first house invariant) and answer only
-- for that partnership — the v2.1225 lesson says partner reads go through
-- RPCs, never junction-referencing RLS policies. Wage privacy holds by
-- construction: everything returned is the partner's own money.
--
--   get_my_partner_summary()          — balance, current-week so-far, latest statement
--   get_my_partner_ledger(p_weeks)    — stub weeks + lines for the ‹ › week nav
--   acknowledge_partner_statement(id) — the partner half of the §9b co-sign

CREATE OR REPLACE FUNCTION public.my_partner_partnership_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.partnerships p
  JOIN public.people pe ON pe.id = p.person_id
  WHERE pe.account_user_id = (SELECT auth.uid())
    AND p.status IN ('draft', 'active')
  LIMIT 1
$$;
ALTER FUNCTION public.my_partner_partnership_id() OWNER TO postgres;
COMMENT ON FUNCTION public.my_partner_partnership_id() IS
  'Caller''s live partnership (draft/active) via people.account_user_id. NULL when the caller is not a partner.';
GRANT ALL ON FUNCTION public.my_partner_partnership_id() TO anon;
GRANT ALL ON FUNCTION public.my_partner_partnership_id() TO authenticated;
GRANT ALL ON FUNCTION public.my_partner_partnership_id() TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_partner_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
  v_p public.partnerships%ROWTYPE;
  v_user uuid;
  v_balance numeric := 0;
  v_week_start date;
  v_field numeric := 0;
  v_office numeric := 0;
  v_farm numeric := 0;
  v_pending int := 0;
  v_latest jsonb;
  v_pend_off jsonb;
BEGIN
  v_pid := public.my_partner_partnership_id();
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = v_pid;
  SELECT pe.account_user_id INTO v_user FROM public.people pe WHERE pe.id = v_p.person_id;

  -- Balance: all posted stubs (gross + additions − deductions) − payouts.
  SELECT COALESCE(SUM(x.net), 0) INTO v_balance FROM (
    SELECT s.gross_pay
      + COALESCE((SELECT SUM(al.line_total) FROM public.pay_stub_additional_lines al WHERE al.pay_stub_id = s.id), 0)
      - COALESCE((SELECT SUM(d.amount) FROM public.pay_stub_deductions d WHERE d.pay_stub_id = s.id), 0)
      - COALESCE((SELECT SUM(pp.amount) FROM public.pay_stub_payments pp WHERE pp.pay_stub_id = s.id), 0) AS net
    FROM public.pay_stubs s WHERE s.person_id = v_p.person_id
  ) x;

  -- Current company week (Sun–Sat, America/Chicago) so-far, from approved sessions.
  v_week_start := (date_trunc('week', (now() AT TIME ZONE 'America/Chicago')::date + 1)::date - 1);
  SELECT
    COALESCE(SUM(CASE WHEN v_p.farm_job_ledger_id IS NOT NULL AND cs.job_ledger_id = v_p.farm_job_ledger_id
        THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cs.job_ledger_id IS NOT NULL AND (v_p.farm_job_ledger_id IS NULL OR cs.job_ledger_id <> v_p.farm_job_ledger_id)
        THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cs.job_ledger_id IS NULL
        THEN EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0 ELSE 0 END), 0)
  INTO v_farm, v_field, v_office
  FROM public.clock_sessions cs
  WHERE cs.user_id = v_user
    AND cs.work_date >= v_week_start
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NOT NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL;

  SELECT COUNT(*) INTO v_pending
  FROM public.clock_sessions cs
  WHERE cs.user_id = v_user
    AND cs.work_date >= v_week_start
    AND cs.clocked_out_at IS NOT NULL
    AND cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.revoked_at IS NULL;

  SELECT jsonb_build_object(
    'pay_stub_id', s.id, 'period_start', s.period_start, 'period_end', s.period_end,
    'hours_total', s.hours_total, 'gross_pay', s.gross_pay,
    'company_ack_at', (SELECT a.acknowledged_at FROM public.statement_acknowledgments a WHERE a.pay_stub_id = s.id AND a.party = 'company'),
    'partner_ack_at', (SELECT a.acknowledged_at FROM public.statement_acknowledgments a WHERE a.pay_stub_id = s.id AND a.party = 'partner'),
    'paid_total', COALESCE((SELECT SUM(pp.amount) FROM public.pay_stub_payments pp WHERE pp.pay_stub_id = s.id), 0)
  ) INTO v_latest
  FROM public.pay_stubs s
  WHERE s.person_id = v_p.person_id
  ORDER BY s.period_start DESC LIMIT 1;

  SELECT jsonb_build_object('count', COUNT(*), 'net', COALESCE(SUM(CASE WHEN o.type IN ('profit_share','employee_credit') THEN o.amount ELSE -o.amount END), 0))
  INTO v_pend_off
  FROM public.person_offsets o
  WHERE o.person_id = v_p.person_id AND o.pay_stub_id IS NULL;

  RETURN jsonb_build_object(
    'exists', true,
    'partnership_id', v_p.id,
    'display_name', v_p.display_name,
    'status', v_p.status,
    'modules', jsonb_build_object(
      'weekly_statement', (v_p.modules ->> 'weekly_statement') = 'true',
      'costing', (v_p.modules ->> 'costing') = 'true',
      'profit_shares', (v_p.modules ->> 'profit_shares') = 'true'
    ),
    'rates', jsonb_build_object('field', v_p.field_rate, 'estimating', v_p.estimating_rate, 'farm', v_p.farm_rate),
    'balance', ROUND(v_balance, 2),
    'pending_offsets', v_pend_off,
    'current_week', jsonb_build_object(
      'week_start', v_week_start,
      'field_hours', ROUND(v_field::numeric, 2), 'office_hours', ROUND(v_office::numeric, 2), 'farm_hours', ROUND(v_farm::numeric, 2),
      'gross_so_far', ROUND((v_field * v_p.field_rate + v_office * v_p.estimating_rate + v_farm * v_p.farm_rate)::numeric, 2),
      'pending_sessions', v_pending
    ),
    'latest_statement', v_latest
  );
END;
$$;
ALTER FUNCTION public.get_my_partner_summary() OWNER TO postgres;
COMMENT ON FUNCTION public.get_my_partner_summary() IS
  'Partner dashboard summary for the CALLER''s own partnership: balance, current-week so-far (approved sessions at deal rates), pending-session count, pending offsets, latest statement + acks. {exists:false} for non-partners.';
GRANT ALL ON FUNCTION public.get_my_partner_summary() TO anon;
GRANT ALL ON FUNCTION public.get_my_partner_summary() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_partner_summary() TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_partner_ledger(p_weeks int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
  v_person uuid;
BEGIN
  v_pid := public.my_partner_partnership_id();
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT person_id INTO v_person FROM public.partnerships WHERE id = v_pid;

  RETURN jsonb_build_object(
    'exists', true,
    'stubs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'period_start', s.period_start, 'period_end', s.period_end,
        'hours_total', s.hours_total, 'gross_pay', s.gross_pay,
        'company_ack_at', (SELECT a.acknowledged_at FROM public.statement_acknowledgments a WHERE a.pay_stub_id = s.id AND a.party = 'company'),
        'partner_ack_at', (SELECT a.acknowledged_at FROM public.statement_acknowledgments a WHERE a.pay_stub_id = s.id AND a.party = 'partner'),
        'day_rates', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('rate', dr.rate_at_time, 'hours', dr.hours, 'amount', dr.amount) ORDER BY dr.rate_at_time DESC)
          FROM (
            SELECT d.rate_at_time, SUM(d.hours_at_time) AS hours, SUM(d.paid_amount) AS amount
            FROM public.pay_stub_days d WHERE d.pay_stub_id = s.id GROUP BY d.rate_at_time
          ) dr
        ), '[]'::jsonb),
        'additional', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('description', al.description, 'amount', al.line_total) ORDER BY al.created_at)
          FROM public.pay_stub_additional_lines al WHERE al.pay_stub_id = s.id
        ), '[]'::jsonb),
        'deductions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('description', d.description, 'amount', d.amount) ORDER BY d.created_at)
          FROM public.pay_stub_deductions d WHERE d.pay_stub_id = s.id
        ), '[]'::jsonb),
        'payments', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('amount', pp.amount, 'paid_at', pp.paid_at, 'memo', pp.memo) ORDER BY pp.paid_at)
          FROM public.pay_stub_payments pp WHERE pp.pay_stub_id = s.id
        ), '[]'::jsonb)
      ) ORDER BY s.period_start DESC)
      FROM (
        SELECT * FROM public.pay_stubs
        WHERE person_id = v_person
        ORDER BY period_start DESC
        LIMIT GREATEST(1, LEAST(COALESCE(p_weeks, 8), 26))
      ) s
    ), '[]'::jsonb)
  );
END;
$$;
ALTER FUNCTION public.get_my_partner_ledger(int) OWNER TO postgres;
COMMENT ON FUNCTION public.get_my_partner_ledger(int) IS
  'The caller-partner''s recent statement weeks (default 8, cap 26) with per-rate labor sums, additions, deductions, payments, and both acknowledgments — feeds the dashboard ‹ › week navigation.';
GRANT ALL ON FUNCTION public.get_my_partner_ledger(int) TO anon;
GRANT ALL ON FUNCTION public.get_my_partner_ledger(int) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_partner_ledger(int) TO service_role;

CREATE OR REPLACE FUNCTION public.acknowledge_partner_statement(p_pay_stub_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
  v_person uuid;
  v_owner uuid;
  v_at timestamptz;
BEGIN
  v_pid := public.my_partner_partnership_id();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a partner';
  END IF;
  SELECT person_id INTO v_person FROM public.partnerships WHERE id = v_pid;
  SELECT person_id INTO v_owner FROM public.pay_stubs WHERE id = p_pay_stub_id;
  IF v_owner IS NULL OR v_owner IS DISTINCT FROM v_person THEN
    RAISE EXCEPTION 'statement not found';
  END IF;

  INSERT INTO public.statement_acknowledgments (pay_stub_id, party, user_id)
  VALUES (p_pay_stub_id, 'partner', auth.uid())
  ON CONFLICT (pay_stub_id, party) DO NOTHING;

  SELECT acknowledged_at INTO v_at
  FROM public.statement_acknowledgments
  WHERE pay_stub_id = p_pay_stub_id AND party = 'partner';

  RETURN jsonb_build_object('pay_stub_id', p_pay_stub_id, 'partner_ack_at', v_at);
END;
$$;
ALTER FUNCTION public.acknowledge_partner_statement(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.acknowledge_partner_statement(uuid) IS
  'Partner half of the §9b statement co-sign: the caller acknowledges their OWN statement (ownership checked via their partnership). Idempotent — the first timestamp stands.';
GRANT ALL ON FUNCTION public.acknowledge_partner_statement(uuid) TO anon;
GRANT ALL ON FUNCTION public.acknowledge_partner_statement(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.acknowledge_partner_statement(uuid) TO service_role;
