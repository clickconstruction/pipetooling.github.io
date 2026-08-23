SET lock_timeout = '3s';

-- Partner statement letterhead (v2.2170): the shared summary payload gains
-- `company_name` (NULL when blank) and `started_on` so the partner's statement
-- can print "Partner account · Herber Electric" and "partner since <deal start>"
-- from the deal itself instead of inferring them. Same body as
-- 20260821150000 otherwise; get_my_partner_summary / get_partner_summary_as
-- are thin wrappers over this function and need no change. Idempotent.

CREATE OR REPLACE FUNCTION public.partner_summary_payload(p_partnership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  IF p_partnership_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT * INTO v_p FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
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
    'company_name', NULLIF(v_p.company_name, ''),
    'started_on', v_p.started_on,
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
ALTER FUNCTION public.partner_summary_payload(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_summary_payload(uuid) IS
  'Inner body shared by get_my_partner_summary and get_partner_summary_as — one implementation, so the dev lens cannot drift from the partner''s own view. Not client-callable.';
REVOKE ALL ON FUNCTION public.partner_summary_payload(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_summary_payload(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.partner_summary_payload(uuid) FROM authenticated;
GRANT ALL ON FUNCTION public.partner_summary_payload(uuid) TO service_role;
