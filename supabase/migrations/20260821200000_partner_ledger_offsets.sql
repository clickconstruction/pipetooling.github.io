SET lock_timeout = '3s';

-- Partner Full ledger shows charges (owner request): the partner should see
-- their back-charges and damages in their own full ledger, at the date they
-- happened — the charges-at-date convention the office Ledger tab adopted in
-- v2.1967. The shared inner payload gains:
--   • 'offsets'  — every person_offset for the partner (id/type/amount/
--                  occurred_date/description); it is all their own money (§4b)
--   • deductions objects carry 'person_offset_id' so the client can skip
--     statement deductions that merely mirror a charge (no double-count)
-- Body otherwise verbatim from 20260821180000 (cap 520). Both resolvers
-- (get_my_partner_ledger, dev lens get_partner_ledger_as) inherit.

CREATE OR REPLACE FUNCTION public.partner_ledger_payload(p_partnership_id uuid, p_weeks int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person uuid;
BEGIN
  IF p_partnership_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT person_id INTO v_person FROM public.partnerships WHERE id = p_partnership_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'offsets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'type', o.type, 'amount', o.amount,
        'occurred_date', o.occurred_date, 'description', o.description
      ) ORDER BY o.occurred_date)
      FROM public.person_offsets o
      WHERE o.person_id = v_person
    ), '[]'::jsonb),
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
          SELECT jsonb_agg(jsonb_build_object('description', d.description, 'amount', d.amount, 'person_offset_id', d.person_offset_id) ORDER BY d.created_at)
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
        LIMIT GREATEST(1, LEAST(COALESCE(p_weeks, 8), 520))
      ) s
    ), '[]'::jsonb)
  );
END;
$$;
ALTER FUNCTION public.partner_ledger_payload(uuid, int) OWNER TO postgres;
COMMENT ON FUNCTION public.partner_ledger_payload(uuid, int) IS
  'Inner body shared by get_my_partner_ledger and get_partner_ledger_as (cap 520 weeks; offsets + deduction offset links for the charges-at-date Full ledger). Not client-callable.';
